import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  isSheetsConfigured,
  readMonthSheet,
  groupCellsIntoBookings,
  writeBookingToSheet,
  clearBookingFromSheet,
  ensureSheetStructure,
  ROOM_COLUMNS,
  SHEET_ROOM_TO_LISTING,
  sheetNameForDate,
  parseSheetName,
  MONTH_NAMES,
} from '../utils/googleSheets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Legacy room name → MongoDB Listing name ─────────────────────────────────
const LEGACY_ROOM_MAP = {
  'Cozy 1':    'Cozy 1',
  'Cozy 2':    'Cozy 2',
  'Cozy Mini': 'Cozy Mini',
  'Dorm':      'Dormitory (Open Loft)',
  'Penthouse': 'Pent House',
};

// ── POST /api/sync/import-legacy ────────────────────────────────────────────
// One-time import of bookings from BNS_bookings_2026.json into the DB.
// Idempotent: skips any booking that already exists for the same room + dates.
export const importLegacy = async (req, res, next) => {
  try {
    const dataPath = join(__dirname, '../data/legacy_bookings_2026.json');
    const raw = await readFile(dataPath, 'utf8');
    const legacyBookings = JSON.parse(raw);

    const adminUser = await import('../models/User.js').then((m) =>
      m.default.findOne({ role: 'admin' })
    );
    if (!adminUser) {
      res.status(500);
      throw new Error('No admin user found — run the seed script first.');
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (const lb of legacyBookings) {
      try {
        const dbName = LEGACY_ROOM_MAP[lb.roomName] || lb.roomName;
        const listing = await Listing.findOne({
          name: new RegExp(`^${dbName}$`, 'i'),
          type: 'room',
        });

        if (!listing) {
          results.errors.push(`Room not found: "${lb.roomName}" (tried "${dbName}")`);
          continue;
        }

        const startDate = new Date(lb.startDate);
        const endDate = new Date(lb.endDate);

        // Skip if a non-cancelled booking already covers these exact dates
        const exists = await Booking.findOne({
          listing: listing._id,
          startDate,
          endDate,
          status: { $ne: 'cancelled' },
        });

        if (exists) {
          results.skipped++;
          continue;
        }

        const pricing = await calculateBookingPrice({
          listing,
          bookingType: 'room',
          startDate,
          endDate,
          guests: 1,
        });

        await Booking.create({
          bookingType: 'room',
          listing: listing._id,
          user: adminUser._id,
          startDate,
          endDate,
          guests: 1,
          unitPrice: pricing.unitPrice,
          totalPrice: pricing.totalPrice,
          pricingBreakdown: { basePrice: pricing.basePrice, adjustments: pricing.adjustments },
          status: lb.status === 'confirmed' ? 'confirmed' : 'pending',
          paymentStatus: 'pending',
          paymentMethod: 'manual',
          contactName: lb.guestName,
          contactEmail: 'legacy-import@bowline.internal',
          contactPhone: '',
          specialRequests: 'Imported from BNS 2026 spreadsheet',
        });

        results.created++;
      } catch (err) {
        results.errors.push(`${lb.roomName} ${lb.startDate}: ${err.message}`);
      }
    }

    res.json({
      message: `Import complete: ${results.created} created, ${results.skipped} already existed`,
      ...results,
      total: legacyBookings.length,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/sync/status ────────────────────────────────────────────────────
export const getSyncStatus = (req, res) => {
  res.json({
    configured: isSheetsConfigured(),
    spreadsheetId: process.env.GOOGLE_SHEETS_ID || null,
    roomMapping: ROOM_COLUMNS,
  });
};

// ── POST /api/sync/setup ────────────────────────────────────────────────────
// Creates all 12 month sheets with headers + date rows
export const setupSheets = async (req, res, next) => {
  try {
    const year = Number(req.body.year) || 2026;
    const result = await ensureSheetStructure(year);
    if (result.error) {
      res.status(400);
      throw new Error(result.error);
    }
    res.json({ message: `Sheet structure ready for ${year}` });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/sync/push ─────────────────────────────────────────────────────
// Push all confirmed/pending bookings from DB → Sheet
export const pushToSheet = async (req, res, next) => {
  try {
    if (!isSheetsConfigured()) {
      res.status(400);
      throw new Error('Google Sheets is not configured. Set GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars.');
    }

    const bookings = await Booking.find({
      bookingType: 'room',
      status: { $in: ['pending', 'confirmed'] },
    })
      .populate('listing', 'name')
      .populate('user', 'name');

    let written = 0;
    for (const booking of bookings) {
      try {
        await writeBookingToSheet(booking);
        written++;
      } catch {
        // Continue on individual failures
      }
    }

    res.json({ message: `Pushed ${written} bookings to Google Sheet`, total: bookings.length });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/sync/pull ─────────────────────────────────────────────────────
// Pull all bookings from Sheet → DB (reconcile)
export const pullFromSheet = async (req, res, next) => {
  try {
    if (!isSheetsConfigured()) {
      res.status(400);
      throw new Error('Google Sheets is not configured.');
    }

    const year = Number(req.body.year) || new Date().getFullYear();
    const results = { created: 0, skipped: 0, errors: [] };

    for (let m = 0; m < 12; m++) {
      const sheetName = `${MONTH_NAMES[m]} ${String(year).slice(-2)}`;
      try {
        const monthData = await readMonthSheet(sheetName);
        if (!monthData) continue;

        for (const [roomName, cells] of Object.entries(monthData.columns)) {
          const sheetBookings = groupCellsIntoBookings(cells, roomName);

          for (const sb of sheetBookings) {
            const dbName = SHEET_ROOM_TO_LISTING[sb.roomName] || sb.roomName;
            const listing = await Listing.findOne({
              name: new RegExp(`^${dbName}$`, 'i'),
              type: 'room',
            });
            if (!listing) continue;

            // Check if a matching booking already exists
            const existing = await Booking.findOne({
              listing: listing._id,
              startDate: sb.startDate,
              endDate: sb.endDate,
              status: { $ne: 'cancelled' },
            });

            if (existing) {
              results.skipped++;
              continue;
            }

            // Need a user to attach — use admin user as proxy for sheet imports
            const adminUser = await import('../models/User.js').then((m) =>
              m.default.findOne({ role: 'admin' })
            );
            if (!adminUser) continue;

            const nights = Math.max(
              Math.round((sb.endDate - sb.startDate) / 86400000),
              1
            );

            const pricing = await calculateBookingPrice({
              listing,
              bookingType: 'room',
              startDate: sb.startDate,
              endDate: sb.endDate,
              guests: 1,
            });

            await Booking.create({
              bookingType: 'room',
              listing: listing._id,
              user: adminUser._id,
              startDate: sb.startDate,
              endDate: sb.endDate,
              guests: 1,
              unitPrice: pricing.unitPrice,
              totalPrice: pricing.totalPrice,
              pricingBreakdown: {
                basePrice: pricing.basePrice,
                adjustments: pricing.adjustments,
              },
              status: sb.status === 'confirmed' ? 'confirmed' : 'pending',
              paymentStatus: 'pending',
              paymentMethod: 'manual',
              contactName: sb.guestName,
              contactEmail: `sheet-import@bowline.internal`,
              contactPhone: '',
              specialRequests: 'Imported from Google Sheet',
            });

            results.created++;
          }
        }
      } catch (err) {
        results.errors.push(`${sheetName}: ${err.message}`);
      }
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/sync/inbound ──────────────────────────────────────────────────
// Called by Apps Script on sheet edit — receives full column data for one room
export const inboundWebhook = async (req, res, next) => {
  try {
    // Verify shared secret
    const secret = req.headers['x-sync-secret'] || req.body.secret;
    if (secret !== process.env.SHEETS_WEBHOOK_SECRET) {
      res.status(401);
      throw new Error('Invalid sync secret');
    }

    const { sheetName, roomName, cells } = req.body;
    // cells: [{ date: "2026-01-01", value: "Guest Name", color: "#b6d7a8" }, ...]

    if (!sheetName || !roomName || !Array.isArray(cells)) {
      res.status(400);
      throw new Error('sheetName, roomName, and cells[] are required');
    }

    const dbRoomName = SHEET_ROOM_TO_LISTING[roomName] || roomName;
    const listing = await Listing.findOne({
      name: new RegExp(`^${dbRoomName}$`, 'i'),
      type: 'room',
    });

    if (!listing) {
      res.status(404);
      throw new Error(`Room listing "${dbRoomName}" not found in database`);
    }

    const normalizedCells = cells.map((c) => ({
      date: new Date(c.date),
      value: (c.value || '').trim(),
      color: c.color || '#ffffff',
    }));

    const sheetBookings = groupCellsIntoBookings(normalizedCells, roomName);

    const parsed = parseSheetName(sheetName);
    if (!parsed) {
      res.status(400);
      throw new Error(`Cannot parse sheet name: ${sheetName}`);
    }

    const monthStart = new Date(parsed.year, parsed.month, 1);
    const monthEnd = new Date(parsed.year, parsed.month + 1, 1);

    // Cancel all existing non-cancelled bookings for this room in this month
    // that are NOT matched by the incoming sheet data
    const existingBookings = await Booking.find({
      listing: listing._id,
      status: { $ne: 'cancelled' },
      startDate: { $lt: monthEnd },
      endDate: { $gt: monthStart },
    });

    const adminUser = await import('../models/User.js').then((m) =>
      m.default.findOne({ role: 'admin' })
    );

    const results = { created: 0, updated: 0, cancelled: 0 };

    // For each booking from the sheet, upsert
    for (const sb of sheetBookings) {
      const existing = existingBookings.find(
        (b) =>
          b.startDate.getTime() === sb.startDate.getTime() &&
          b.endDate.getTime() === sb.endDate.getTime()
      );

      if (existing) {
        // Update status/name if changed
        const newStatus = sb.status === 'confirmed' ? 'confirmed' : 'pending';
        if (existing.status !== newStatus || existing.contactName !== sb.guestName) {
          existing.status = newStatus;
          existing.contactName = sb.guestName;
          await existing.save();
          results.updated++;
        }
      } else {
        const pricing = await calculateBookingPrice({
          listing,
          bookingType: 'room',
          startDate: sb.startDate,
          endDate: sb.endDate,
          guests: 1,
        });

        await Booking.create({
          bookingType: 'room',
          listing: listing._id,
          user: adminUser?._id,
          startDate: sb.startDate,
          endDate: sb.endDate,
          guests: 1,
          unitPrice: pricing.unitPrice,
          totalPrice: pricing.totalPrice,
          pricingBreakdown: { basePrice: pricing.basePrice, adjustments: pricing.adjustments },
          status: sb.status === 'confirmed' ? 'confirmed' : 'pending',
          paymentStatus: 'pending',
          paymentMethod: 'manual',
          contactName: sb.guestName,
          contactEmail: 'sheet-import@bowline.internal',
          contactPhone: '',
          specialRequests: 'Created via Google Sheet',
        });
        results.created++;
      }
    }

    // Cancel bookings that disappeared from the sheet
    const sheetDateRanges = sheetBookings.map((sb) => ({
      start: sb.startDate.getTime(),
      end: sb.endDate.getTime(),
    }));

    for (const b of existingBookings) {
      const stillExists = sheetDateRanges.some(
        (r) => r.start === b.startDate.getTime() && r.end === b.endDate.getTime()
      );
      if (!stillExists) {
        b.status = 'cancelled';
        await b.save();
        results.cancelled++;
      }
    }

    res.json({ ok: true, ...results });
  } catch (err) {
    next(err);
  }
};
