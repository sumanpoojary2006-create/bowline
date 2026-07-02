// ── Bowline × Google Sheets — Apps Script only (no Google Cloud) ────────────
//
// App → Sheet:  backend POSTs booking data to the Apps Script web app URL.
//               Apps Script doPost() receives it and writes/clears cells.
//
// Sheet → App:  Apps Script onEdit() POSTs column data to /api/sync/inbound.
//
// Required env vars:
//   APPS_SCRIPT_WEB_APP_URL  – the deployed Apps Script web app URL
//   SHEETS_WEBHOOK_SECRET    – shared secret (same value in Apps Script + here)

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
};

// The Sheet's cell color is keyed on this calendar status, which is a step
// finer-grained than Booking.status — a 50% deposit still blocks the room
// (status stays 'confirmed') but should render as yellow, not green, so the
// admin can see at a glance that the balance is still outstanding.
function getCalendarStatus(booking) {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.paymentStatus === 'partially_paid') return 'partially_paid';
  return booking.status;
}

export function isSheetsConfigured() {
  return Boolean(process.env.APPS_SCRIPT_WEB_APP_URL);
}

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

async function callAppsScript(payload) {
  const url = process.env.APPS_SCRIPT_WEB_APP_URL;
  if (!url) return;

  return enqueueAppsScriptCall(async () => {
    const body = JSON.stringify({
      ...payload,
      secret: process.env.SHEETS_WEBHOOK_SECRET || '',
    });

    // Apps Script web apps redirect from /exec to /exec?... — follow redirects
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`Apps Script responded ${res.status}: ${await res.text()}`);
    }
    return res.json().catch(() => ({}));
  });
}

// ── Write a booking into the sheet ────────────────────────────────────────
export async function writeBookingToSheet(booking) {
  if (!isSheetsConfigured()) return;

  const roomName = booking.listing?.name ?? booking.listing;
  if (!roomName || !ROOM_COLUMN_INDEX[roomName]) return;

  const calStatus = getCalendarStatus(booking);
  await callAppsScript({
    action:    'upsert',
    roomName,
    guestName: booking.contactName || booking.user?.name || '',
    startDate: toDateStr(booking.startDate),
    endDate:   toDateStr(booking.endDate),
    status:    calStatus,
    color:     STATUS_COLORS[calStatus] ?? '#ffffff',
  });
}

// ── Clear a booking from the sheet (on cancel) ─────────────────────────────
export async function clearBookingFromSheet(booking) {
  if (!isSheetsConfigured()) return;

  const roomName = booking.listing?.name ?? booking.listing;
  if (!roomName || !ROOM_COLUMN_INDEX[roomName]) return;

  await callAppsScript({
    action:    'clear',
    roomName,
    startDate: toDateStr(booking.startDate),
    endDate:   toDateStr(booking.endDate),
  });
}

// ── Full booking sync — one row per booking in the "Bookings" tab ──────────
// Column order in the "Bookings" sheet tab (row 1 = headers):
//   A: Booking ID   B: Room        C: Guest Name   D: Email
//   E: Phone        F: Check-in    G: Check-out    H: Adults
//   I: Children     J: Pets        K: Veg Meals    L: Non-Veg Meals
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
      vegMeals: booking.vegCount ?? 0,
      nonVegMeals: booking.nonVegCount ?? 0,
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
      guestName: b.contactName || b.user?.name || '',
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
    vegMeals: b.vegCount ?? 0,
    nonVegMeals: b.nonVegCount ?? 0,
    totalPrice: b.totalPrice ?? 0,
    status: b.status,
    paymentStatus: b.paymentStatus,
  }));

  if (items.length === 0) return { pushed: 0 };

  await callAppsScript({ action: 'bulkUpsertBookings', items });
  return { pushed: items.length };
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
    if (!guest) {
      if (current) { bookings.push(current); current = null; }
      continue;
    }
    if (current && current.guestName === guest) {
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
        status:    mapColor(cell.color),
      };
    }
  }
  if (current) bookings.push(current);
  return bookings;
}

function mapColor(hex) {
  const h = (hex || '').toLowerCase();
  if (h === '#b6d7a8' || h === '#93c47d') return 'confirmed';
  return 'pending';
}

// Maps sheet header names → MongoDB Listing.name (same values now)
export const SHEET_ROOM_TO_LISTING = Object.fromEntries(
  Object.keys(ROOM_COLUMN_INDEX).map((k) => [k, k])
);
