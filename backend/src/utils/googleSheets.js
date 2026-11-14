// ── Bowline × Google Sheets — Apps Script only (no Google Cloud) ────────────
//
// App → Sheet:  backend POSTs booking data to the Apps Script web app URL.
//               Apps Script doPost() receives it and writes/clears cells.
//
// Sheet → App:  Apps Script onEdit() POSTs column data to /api/sync/inbound.
//
// Required env vars:
//   APPS_SCRIPT_WEB_APP_URL  – the deployed Apps Script web app URL for the
//                              main bookings/laundry/WhatsApp spreadsheet
//   ATTENDANCE_APPS_SCRIPT_WEB_APP_URL – the deployed Apps Script web app URL
//                              for the separate staff attendance spreadsheet
//   SHEETS_WEBHOOK_SECRET    – secret accepted on Sheet → App webhooks, and
//                              shared by both Apps Script deployments above
//   APPS_SCRIPT_OUTBOUND_SECRET – optional separate legacy secret used only
//                                 for App → Sheet calls

import Booking from '../models/Booking.js';

// ── Room name → column index in the sheet (1-based, col A = 1) ────────────
// These must match the column headers in your Google Sheet, row 1.
// Keys = exact MongoDB Listing.name values.
export const ROOM_COLUMN_INDEX = {
  'Cozy 1':     { idx: 2 },
  'Cozy 2':     { idx: 3 },
  'Cozy Mini':  { idx: 4 },
  'Dormitory':  { idx: 5 },
  'Pent House': { idx: 6 },
};

export const STATUS_COLORS = {
  confirmed:      '#b6d7a8', // green  – fully paid
  partially_paid: '#ffe599', // yellow – 50% deposit paid
  pending:        '#ffffff', // no color – not yet confirmed
  cancelled:      '#ffffff', // no color – cleared
  blocked:        '#e06666', // red    – admin-blocked, unavailable to guests
};

// The Sheet's cell color is keyed on this calendar status, which is a step
// finer-grained than Booking.status — a 50% deposit still blocks the room
// (status stays 'confirmed') but should render as yellow, not green, so the
// admin can see at a glance that the balance is still outstanding.
function getCalendarStatus(booking) {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'blocked') return 'blocked';
  if (booking.paymentStatus === 'partially_paid') return 'partially_paid';
  return booking.status;
}

export function isSheetsConfigured() {
  return Boolean(
    process.env.APPS_SCRIPT_WEB_APP_URL &&
      (process.env.APPS_SCRIPT_OUTBOUND_SECRET || process.env.SHEETS_WEBHOOK_SECRET)
  );
}

// The staff attendance spreadsheet is a separate Apps Script deployment from
// the main bookings/laundry one, so booking/laundry writes never touch it
// and vice versa.
// Deliberately ignores APPS_SCRIPT_OUTBOUND_SECRET — that var exists only to
// migrate the main sheet's older receiver secret, and would otherwise take
// priority over SHEETS_WEBHOOK_SECRET for this unrelated spreadsheet too.
export function isAttendanceSheetsConfigured() {
  return Boolean(process.env.ATTENDANCE_APPS_SCRIPT_WEB_APP_URL && process.env.SHEETS_WEBHOOK_SECRET);
}

const getAppsScriptSecret = () =>
  process.env.APPS_SCRIPT_OUTBOUND_SECRET || process.env.SHEETS_WEBHOOK_SECRET || '';

const getAttendanceAppsScriptSecret = () => process.env.SHEETS_WEBHOOK_SECRET || '';

// ── Call the Apps Script web app ───────────────────────────────────────────
// Apps Script has no locking around the spreadsheet, so concurrent doPost
// invocations (e.g. several rooms booked together) can silently collide and
// drop writes. Serialize every call from this process so at most one is ever
// in flight — this only helps within a single server instance, so callers
// that fan out across separate HTTP requests (e.g. one request per room)
// should also submit sequentially on the client side.
let appsScriptQueue = Promise.resolve();

function enqueueAppsScriptCall(task) {
  const result = appsScriptQueue.then(task, task);
  appsScriptQueue = result.then(
    () => {},
    () => {}
  );
  return result;
}

async function callAppsScript(payload, urlOverride, secretOverride) {
  const url = urlOverride || process.env.APPS_SCRIPT_WEB_APP_URL;
  if (!url) return;

  return enqueueAppsScriptCall(async () => {
    const body = JSON.stringify({
      ...payload,
      secret: secretOverride || getAppsScriptSecret(),
    });

    // Every operation is an idempotent upsert/clear, so retrying transient
    // Apps Script failures is safe. A timeout prevents the admin status page
    // from hanging indefinitely when Google is unavailable.
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        // Apps Script web apps redirect from /exec to /exec?... — follow redirects.
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          throw new Error(`Apps Script responded ${res.status}: ${await res.text()}`);
        }

        // Apps Script catches its own errors and still replies with HTTP 200.
        const result = await res.json().catch(() => ({}));
        if (result.ok === false) {
          // Authentication and validation errors are permanent; do not retry.
          throw Object.assign(new Error(result.error || 'Apps Script reported failure'), {
            permanent: true,
          });
        }
        return result;
      } catch (error) {
        lastError = error;
        if (error.permanent || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * 3 ** attempt));
      }
    }

    throw lastError;
  });
}

// A zero-item bulk write is supported by every deployed Bowline Apps Script
// version and has no sheet side effects. It verifies the URL, deployment and
// secret instead of merely reporting that environment variables exist.
export async function checkSheetsConnection() {
  if (!isSheetsConfigured()) {
    return { connected: false, error: 'Sheet sync environment variables are incomplete' };
  }

  try {
    await callAppsScript({ action: 'bulkUpsert', items: [] });
    return { connected: true, error: null };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

// Same zero-item no-op, aimed at the attendance spreadsheet's deployment —
// confirms its URL and secret actually authenticate, not just that the env
// vars are present.
export async function checkAttendanceSheetsConnection() {
  if (!isAttendanceSheetsConfigured()) {
    return { connected: false, error: 'Attendance sheet sync environment variables are incomplete' };
  }

  try {
    await callAppsScript(
      { action: 'bulkUpsert', items: [] },
      process.env.ATTENDANCE_APPS_SCRIPT_WEB_APP_URL,
      getAttendanceAppsScriptSecret()
    );
    return { connected: true, error: null };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

// A block's "guest" is a fake placeholder contact — show the admin's reason
// for blocking instead, which is what's actually useful in the cell.
function cellLabelFor(booking) {
  if (booking.status === 'blocked') return booking.blockNote || 'Blocked';
  return booking.contactName || booking.user?.name || '';
}

// ── Write a booking into the sheet ────────────────────────────────────────
export async function writeBookingToSheet(booking) {
  if (!isSheetsConfigured()) return;

  const roomName = booking.listing?.name ?? booking.listing;
  if (!roomName || !ROOM_COLUMN_INDEX[roomName]) return;

  const calStatus = getCalendarStatus(booking);
  const cellLabel = cellLabelFor(booking);

  await callAppsScript({
    action:    'upsert',
    roomName,
    guestName: cellLabel,
    startDate: toDateStr(booking.startDate),
    endDate:   toDateStr(booking.endDate),
    status:    calStatus,
    color:     STATUS_COLORS[calStatus] ?? '#ffffff',
  });
}

// ── Redraw a room's cells for a date range ────────────────────────────────
// Blanking a range outright erases whatever else sits on those dates — a
// manual block, an Airbnb reservation, another guest — which is how names
// went missing from the sheet. Anything that removes a booking has to redraw
// the range from what's left in the database instead of clearing it.
const DAY_MS = 24 * 60 * 60 * 1000;

export async function refreshSheetRange(listing, startDate, endDate) {
  if (!isSheetsConfigured()) return;

  const roomName = listing?.name;
  const listingId = listing?._id ?? listing;
  if (!roomName || !ROOM_COLUMN_INDEX[roomName] || !listingId) return;

  const start = new Date(`${toDateStr(startDate)}T00:00:00.000Z`);
  const end = new Date(`${toDateStr(endDate)}T00:00:00.000Z`);
  if (end <= start) return;

  const bookings = await Booking.find({
    listing: listingId,
    status: { $in: ['pending', 'confirmed', 'blocked'] },
    startDate: { $lt: end },
    endDate: { $gt: start },
  })
    .populate('user', 'name')
    .sort({ startDate: 1 });

  // Several records can legitimately cover the same night — an Airbnb-side
  // block landing on dates we already hold, or an unpaid hold sitting under a
  // real reservation. A booking that actually holds the room outranks one
  // that doesn't, and between equals our own record wins because it carries
  // the name a human wrote.
  const holdsRoom = (b) => b.status !== 'pending' || ['paid', 'partially_paid'].includes(b.paymentStatus);
  bookings.sort(
    (a, b) =>
      Number(holdsRoom(b)) - Number(holdsRoom(a)) ||
      Number(a.source === 'airbnb') - Number(b.source === 'airbnb')
  );

  // Group consecutive days that resolve to the same cell contents into one
  // Apps Script call, so a month-long range costs a couple of requests
  // rather than one per day.
  const runs = [];
  for (let time = start.getTime(); time < end.getTime(); time += DAY_MS) {
    const day = new Date(time);
    const occupant = bookings.find((b) => b.startDate <= day && b.endDate > day);
    const guestName = occupant ? cellLabelFor(occupant) : '';
    const status = occupant ? getCalendarStatus(occupant) : null;
    const previous = runs[runs.length - 1];

    if (previous && previous.guestName === guestName && previous.status === status) {
      previous.end = new Date(time + DAY_MS);
    } else {
      runs.push({ guestName, status, start: day, end: new Date(time + DAY_MS) });
    }
  }

  const occupied = runs.filter((run) => run.status);

  for (const run of runs.filter((r) => !r.status)) {
    await callAppsScript({
      action:    'clear',
      roomName,
      startDate: toDateStr(run.start),
      endDate:   toDateStr(run.end),
    });
  }

  if (occupied.length) {
    await callAppsScript({
      action: 'bulkUpsert',
      items: occupied.map((run) => ({
        roomName,
        guestName: run.guestName,
        startDate: toDateStr(run.start),
        endDate:   toDateStr(run.end),
        status:    run.status,
      })),
    });
  }
}

// ── Full booking sync — one row per booking in the "Bookings" tab ──────────
// Column order in the "Bookings" sheet tab (row 1 = headers):
//   A: Booking ID   B: Room        C: Guest Name   D: Email
//   E: Phone        F: Check-in    G: Check-out    H: Adults
//   I: Children     J: Pets        K: Veg Meals     L: Non-Veg Meals
//   M: Total Price  N: Status      O: Payment Status
export const BOOKING_SHEET_NAME = 'Bookings';

export const BOOKING_SHEET_HEADERS = [
  'Booking ID',
  'Room',
  'Guest Name',
  'Email',
  'Phone',
  'Check-in',
  'Check-out',
  'Adults',
  'Children',
  'Pets',
  'Veg Meals',
  'Non-Veg Meals',
  'Total Price',
  'Status',
  'Payment Status',
];

export async function writeFullBookingToSheet(booking) {
  if (!isSheetsConfigured()) return;

  await callAppsScript({
    action: 'upsertBooking',
    booking: {
      bookingId: String(booking._id),
      roomName: booking.listing?.name ?? '',
      guestName: booking.contactName || booking.user?.name || '',
      email: booking.contactEmail || booking.user?.email || '',
      phone: booking.contactPhone || '',
      checkIn: toDateStr(booking.startDate),
      checkOut: toDateStr(booking.endDate),
      adults: booking.adultGuests ?? booking.guests ?? 1,
      children: booking.childGuests ?? 0,
      pets: booking.pets ?? 0,
      // These legacy columns still exist in the operational sheet. New app
      // bookings do not collect meal counts, so the Apps Script preserves
      // existing values on updates and uses zero only for newly-added rows.
      vegMeals: null,
      nonVegMeals: null,
      totalPrice: booking.totalPrice ?? 0,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    },
  });
}

// ── Push all bookings at once (bulk push) ──────────────────────────────────
export async function pushAllBookingsToSheet(bookings) {
  if (!isSheetsConfigured()) return { pushed: 0 };

  const items = bookings
    .filter((b) => b.listing?.name && ROOM_COLUMN_INDEX[b.listing.name])
    .map((b) => ({
      roomName:  b.listing.name,
      guestName: cellLabelFor(b),
      startDate: toDateStr(b.startDate),
      endDate:   toDateStr(b.endDate),
      status:    getCalendarStatus(b),
    }));

  if (items.length === 0) return { pushed: 0 };

  await callAppsScript({ action: 'bulkUpsert', items });
  return { pushed: items.length };
}

// ── Push all bookings to the "Bookings" tab at once (bulk push) ───────────
export async function pushAllFullBookingsToSheet(bookings) {
  if (!isSheetsConfigured()) return { pushed: 0 };

  const items = bookings.map((b) => ({
    bookingId: String(b._id),
    roomName: b.listing?.name ?? '',
    guestName: b.contactName || b.user?.name || '',
    email: b.contactEmail || b.user?.email || '',
    phone: b.contactPhone || '',
    checkIn: toDateStr(b.startDate),
    checkOut: toDateStr(b.endDate),
    adults: b.adultGuests ?? b.guests ?? 1,
    children: b.childGuests ?? 0,
    pets: b.pets ?? 0,
    vegMeals: null,
    nonVegMeals: null,
    totalPrice: b.totalPrice ?? 0,
    status: b.status,
    paymentStatus: b.paymentStatus,
  }));

  if (items.length === 0) return { pushed: 0 };

  await callAppsScript({ action: 'bulkUpsertBookings', items });
  return { pushed: items.length };
}

// ── Staff attendance — one tab per calendar month, 3 columns only ─────────
// Column order in each "Attendance <Month>" tab (row 1 = headers):
//   A: Employee Name   B: Check-in   C: Check-out
export async function writeAttendanceToSheet({ employeeName, date, checkInAt, checkOutAt }) {
  if (!isAttendanceSheetsConfigured()) return;

  await callAppsScript(
    {
      action: 'upsertAttendance',
      date,
      employeeName,
      checkInAt: checkInAt ? new Date(checkInAt).toISOString() : '',
      checkOutAt: checkOutAt ? new Date(checkOutAt).toISOString() : '',
    },
    process.env.ATTENDANCE_APPS_SCRIPT_WEB_APP_URL,
    getAttendanceAppsScriptSecret()
  );
}

// ── Monthly salary summary — one tab per month, reflects leave/salary calc ─
export async function writeSalarySummaryToSheet({ month, employeeName, summary }) {
  if (!isAttendanceSheetsConfigured()) return;

  await callAppsScript(
    {
      action: 'upsertSalarySummary',
      month,
      employeeName,
      fullDays: summary.fullDays,
      halfDays: summary.halfDays,
      leaveDays: summary.leaveDays,
      excessLeaveDays: summary.excessLeaveDays,
      calculatedSalary: summary.calculatedSalary,
    },
    process.env.ATTENDANCE_APPS_SCRIPT_WEB_APP_URL,
    getAttendanceAppsScriptSecret()
  );
}

// ── Push a WhatsApp contact into the "WhatsApp Leads" tab ─────────────────
export async function writeWhatsAppContactToSheet(contact) {
  if (!isSheetsConfigured()) return;

  await callAppsScript({
    action: 'upsertContact',
    phone: contact.phone,
    profileName: contact.profileName || '',
    firstSeenAt: new Date(contact.firstSeenAt).toISOString(),
    lastSeenAt: new Date(contact.lastSeenAt).toISOString(),
    messageCount: contact.messageCount,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function toDateStr(value) {
  return new Date(value).toISOString().slice(0, 10);
}

// Used by inbound webhook to group consecutive same-guest cells into bookings
export function groupCellsIntoBookings(cells, roomName) {
  const bookings = [];
  let current = null;

  for (const cell of cells) {
    const guest = (cell.value || '').trim();
    const status = mapColor(cell.color);
    if (!guest) {
      if (current) { bookings.push(current); current = null; }
      continue;
    }
    if (current && current.guestName === guest && current.status === status) {
      const end = new Date(cell.date);
      end.setDate(end.getDate() + 1);
      current.endDate = end;
    } else {
      if (current) bookings.push(current);
      const end = new Date(cell.date);
      end.setDate(end.getDate() + 1);
      current = {
        roomName,
        guestName: guest,
        startDate: new Date(cell.date),
        endDate:   end,
        status,
      };
    }
  }
  if (current) bookings.push(current);
  return bookings;
}

function mapColor(hex) {
  const h = (hex || '').toLowerCase();
  if (h === '#e06666' || h === '#cc0000' || h === '#ea9999') return 'blocked';
  if (h === '#b6d7a8' || h === '#93c47d') return 'confirmed';
  // Yellow represents a confirmed booking with a deposit outstanding. The
  // calendar-column webhook does not carry payment details, but it must still
  // preserve the fact that the room is unavailable.
  if (h === '#ffe599' || h === '#ffd966') return 'confirmed';
  return 'pending';
}

// Maps sheet header names → MongoDB Listing.name (same values now)
export const SHEET_ROOM_TO_LISTING = Object.fromEntries(
  Object.keys(ROOM_COLUMN_INDEX).map((k) => [k, k])
);
