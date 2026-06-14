import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import {
  isSheetsConfigured,
  pushAllBookingsToSheet,
  pushAllFullBookingsToSheet,
  groupCellsIntoBookings,
  SHEET_ROOM_TO_LISTING,
} from '../utils/googleSheets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Maps old Excel room names → MongoDB Listing.name
const LEGACY_ROOM_MAP = {
  'Cozy 1':    'Cozy 1',
  'Cozy 2':    'Cozy 2',
  'Cozy Mini': 'Cozy Mini',
  'Dorm':      'Dormitory (Open Loft)',
  'Penthouse': 'Pent House',
};

// ── GET /api/sync/status ────────────────────────────────────────────────────
export const getSyncStatus = (req, res) => {
  res.json({
    configured: isSheetsConfigured(),
    appsScriptUrl: process.env.APPS_SCRIPT_WEB_APP_URL
      ? '(set)'
      : null,
  });
};

// ── POST /api/sync/push ─────────────────────────────────────────────────────
// Pushes all active room bookings from DB → Google Sheet via Apps Script
export const pushToSheet = async (req, res, next) => {
  try {
    if (!isSheetsConfigured()) {
      res.status(400);
      throw new Error('Set APPS_SCRIPT_WEB_APP_URL and SHEETS_WEBHOOK_SECRET env vars first.');
    }

    const bookings = await Booking.find({
      bookingType: 'room',
      status: { $in: ['pending', 'confirmed'] },
    })
      .populate('listing', 'name')
      .populate('user', 'name');

    const { pushed } = await pushAllBookingsToSheet(bookings);
    const { pushed: pushedFull } = await pushAllFullBookingsToSheet(bookings);
    res.json({
      message: `Pushed ${pushed} bookings to the calendar and ${pushedFull} rows to the Bookings sheet`,
      total: bookings.length,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/sync/inbound ──────────────────────────────────────────────────
// Called by Apps Script onEdit — receives full column data for one room
export const inboundWebhook = async (req, res, next) => {
  try {
    const secret = req.headers['x-sync-secret'] || req.body.secret;
    if (secret !== process.env.SHEETS_WEBHOOK_SECRET) {
      res.status(401);
      throw new Error('Invalid sync secret');
    }

    const { sheetName, roomName, cells } = req.body;

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
      date:  new Date(c.date),
      value: (c.value || '').trim(),
      color: c.color || '#ffffff',
    }));

    const sheetBookings = groupCellsIntoBookings(normalizedCells, roomName);

    // Determine month range from sheet name
    const parts = sheetName.trim().split(/\s+/);
    const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monthIdx = MONTHS.indexOf((parts[0] || '').toLowerCase());
    const year = 2000 + parseInt(parts[1] || '26', 10);

    if (monthIdx === -1) {
      res.status(400);
      throw new Error(`Cannot parse sheet name: ${sheetName}`);
    }

    const monthStart = new Date(year, monthIdx, 1);
    const monthEnd   = new Date(year, monthIdx + 1, 1);

    const existingBookings = await Booking.find({
      listing: listing._id,
      status:  { $ne: 'cancelled' },
      startDate: { $lt: monthEnd },
      endDate:   { $gt: monthStart },
    });

    const adminUser = await import('../models/User.js').then((m) =>
      m.default.findOne({ role: 'admin' })
    );

    const results = { created: 0, updated: 0, cancelled: 0 };

    for (const sb of sheetBookings) {
      const existing = existingBookings.find(
        (b) =>
          b.startDate.getTime() === sb.startDate.getTime() &&
          b.endDate.getTime()   === sb.endDate.getTime()
      );

      if (existing) {
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
          endDate:   sb.endDate,
          guests:    1,
        });

        await Booking.create({
          bookingType:  'room',
          listing:      listing._id,
          user:         adminUser?._id,
          startDate:    sb.startDate,
          endDate:      sb.endDate,
          guests:       1,
          unitPrice:    pricing.unitPrice,
          totalPrice:   pricing.totalPrice,
          pricingBreakdown: { basePrice: pricing.basePrice, adjustments: pricing.adjustments },
          status:       sb.status === 'confirmed' ? 'confirmed' : 'pending',
          paymentStatus: 'pending',
          paymentMethod: 'manual',
          contactName:  sb.guestName,
          contactEmail: 'sheet-import@bowline.internal',
          contactPhone: '',
          specialRequests: 'Created via Google Sheet',
        });
        results.created++;
      }
    }

    // Cancel bookings that were removed from the sheet
    const sheetRanges = sheetBookings.map((sb) => ({
      start: sb.startDate.getTime(),
      end:   sb.endDate.getTime(),
    }));

    for (const b of existingBookings) {
      const stillPresent = sheetRanges.some(
        (r) => r.start === b.startDate.getTime() && r.end === b.endDate.getTime()
      );
      if (!stillPresent) {
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

// ── POST /api/sync/bookings-inbound ─────────────────────────────────────────
// Called by Apps Script onEdit on the "Bookings" tab — receives one full row.
// If bookingId is present, updates that booking. Otherwise creates a new one
// and returns its generated id so Apps Script can write it back into column A.
export const bookingRowInbound = async (req, res, next) => {
  try {
    const secret = req.headers['x-sync-secret'] || req.body.secret;
    if (secret !== process.env.SHEETS_WEBHOOK_SECRET) {
      res.status(401);
      throw new Error('Invalid sync secret');
    }

    const {
      bookingId,
      roomName,
      guestName,
      email,
      phone,
      checkIn,
      checkOut,
      adults,
      children,
      pets,
      vegMeals,
      nonVegMeals,
      totalPrice,
      status,
      paymentStatus,
    } = req.body;

    const dbRoomName = SHEET_ROOM_TO_LISTING[roomName] || roomName;

    if (bookingId) {
      const booking = await Booking.findById(bookingId).populate('listing');
      if (!booking) {
        res.status(404);
        throw new Error(`Booking ${bookingId} not found`);
      }

      if (checkIn) booking.startDate = new Date(checkIn);
      if (checkOut) booking.endDate = new Date(checkOut);
      if (guestName) booking.contactName = guestName;
      if (email) booking.contactEmail = email;
      if (phone !== undefined) booking.contactPhone = phone;
      if (adults !== undefined && adults !== '') booking.adultGuests = Number(adults);
      if (children !== undefined && children !== '') booking.childGuests = Number(children);
      if (pets !== undefined && pets !== '') booking.pets = Number(pets);
      if (vegMeals !== undefined && vegMeals !== '') booking.vegCount = Number(vegMeals);
      if (nonVegMeals !== undefined && nonVegMeals !== '') booking.nonVegCount = Number(nonVegMeals);
      if (totalPrice !== undefined && totalPrice !== '') booking.totalPrice = Number(totalPrice);
      if (status) booking.status = status;
      if (paymentStatus) booking.paymentStatus = paymentStatus;

      await booking.save();

      const populated = await Booking.findById(booking._id).populate('listing').populate('user', 'name email');
      if (populated.status === 'cancelled') {
        await import('../utils/googleSheets.js').then((m) => m.clearBookingFromSheet(populated).catch(() => {}));
      } else {
        await import('../utils/googleSheets.js').then((m) => m.writeBookingToSheet(populated).catch(() => {}));
      }

      return res.json({ ok: true, bookingId: String(populated._id) });
    }

    // No bookingId — create a new booking from the sheet row
    if (!dbRoomName || !checkIn || !checkOut || !guestName) {
      res.status(400);
      throw new Error('roomName, checkIn, checkOut, and guestName are required to create a booking');
    }

    const listing = await Listing.findOne({
      name: new RegExp(`^${dbRoomName}$`, 'i'),
      type: 'room',
    });

    if (!listing) {
      res.status(404);
      throw new Error(`Room listing "${dbRoomName}" not found in database`);
    }

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const normalizedAdults = adults !== undefined && adults !== '' ? Number(adults) : 1;
    const normalizedChildren = children !== undefined && children !== '' ? Number(children) : 0;
    const normalizedPets = pets !== undefined && pets !== '' ? Number(pets) : 0;
    const normalizedVeg = vegMeals !== undefined && vegMeals !== '' ? Number(vegMeals) : 0;
    const normalizedNonVeg = nonVegMeals !== undefined && nonVegMeals !== '' ? Number(nonVegMeals) : 0;

    let unitPrice, finalTotalPrice, pricingBreakdown;
    if (totalPrice !== undefined && totalPrice !== '' && Number(totalPrice) > 0) {
      finalTotalPrice = Number(totalPrice);
      unitPrice = finalTotalPrice;
      pricingBreakdown = { basePrice: finalTotalPrice, adjustments: [] };
    } else {
      const pricing = await calculateBookingPrice({
        listing,
        bookingType: 'room',
        startDate,
        endDate,
        guests: normalizedAdults + normalizedChildren,
        adultGuests: normalizedAdults,
        childGuests: normalizedChildren,
        pets: normalizedPets,
      });
      unitPrice = pricing.unitPrice;
      finalTotalPrice = pricing.totalPrice;
      pricingBreakdown = { basePrice: pricing.basePrice, adjustments: pricing.adjustments };
    }

    const adminUser = await import('../models/User.js').then((m) =>
      m.default.findOne({ role: 'admin' })
    );

    const newBooking = await Booking.create({
      bookingType: 'room',
      listing: listing._id,
      user: adminUser?._id ?? null,
      startDate,
      endDate,
      guests: normalizedAdults + normalizedChildren,
      adultGuests: normalizedAdults,
      childGuests: normalizedChildren,
      pets: normalizedPets,
      vegCount: normalizedVeg,
      nonVegCount: normalizedNonVeg,
      unitPrice,
      totalPrice: finalTotalPrice,
      pricingBreakdown,
      status: status === 'cancelled' ? 'pending' : (status || 'confirmed'),
      paymentStatus: paymentStatus || 'pending',
      paymentMethod: 'manual',
      contactName: guestName,
      contactEmail: email || 'sheet-import@bowline.internal',
      contactPhone: phone || '',
      specialRequests: 'Created via Google Sheet',
    });

    const populated = await Booking.findById(newBooking._id).populate('listing').populate('user', 'name email');
    await import('../utils/googleSheets.js').then((m) => m.writeBookingToSheet(populated).catch(() => {}));

    res.json({ ok: true, bookingId: String(newBooking._id) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/sync/import-legacy ────────────────────────────────────────────
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
        const endDate   = new Date(lb.endDate);

        const exists = await Booking.findOne({
          listing:   listing._id,
          startDate,
          endDate,
          status:    { $ne: 'cancelled' },
        });

        if (exists) { results.skipped++; continue; }

        const pricing = await calculateBookingPrice({
          listing,
          bookingType: 'room',
          startDate,
          endDate,
          guests: 1,
        });

        await Booking.create({
          bookingType:  'room',
          listing:      listing._id,
          user:         adminUser._id,
          startDate,
          endDate,
          guests:       1,
          unitPrice:    pricing.unitPrice,
          totalPrice:   pricing.totalPrice,
          pricingBreakdown: { basePrice: pricing.basePrice, adjustments: pricing.adjustments },
          status:       lb.status === 'confirmed' ? 'confirmed' : 'pending',
          paymentStatus: 'pending',
          paymentMethod: 'manual',
          contactName:  lb.guestName,
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
