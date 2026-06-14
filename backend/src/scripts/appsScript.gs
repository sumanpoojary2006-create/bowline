// ════════════════════════════════════════════════════════════════════════════
// Bowline ⇄ Google Sheets sync — Apps Script
//
// Paste this entire file into Extensions > Apps Script in your Google Sheet,
// replacing whatever is in Code.gs. Then:
//   1. Set BACKEND_URL below to your deployed backend's base URL
//      (e.g. "https://bowline-api.onrender.com" — NO trailing slash).
//   2. Set SHEETS_SECRET below to the same value as SHEETS_WEBHOOK_SECRET
//      in your backend .env.
//   3. Deploy > New deployment > Web app
//        - Execute as: Me
//        - Who has access: Anyone
//      Copy the web app URL into APPS_SCRIPT_WEB_APP_URL in backend/.env.
//   4. From the Apps Script editor, run `setupTriggers` once (top toolbar:
//      select "setupTriggers" from the function dropdown, click Run, and
//      grant the requested permissions). This installs the onEdit trigger
//      that lets you edit the sheet and have it sync back to the database.
//
// Sheet layout this script expects:
//
//   Calendar month tabs (e.g. "Jun 26", "Jul 26", ...):
//     Row 1: A1 = "Date", B1.."F1" = room names matching ROOM_COLUMN_INDEX
//            below ("Cozy 1", "Cozy 2", "Cozy Mini",
//            "Dormitory (Open Loft)", "Pent House")
//     Col A, rows 2+: one date per row (the days of that month)
//     Cols B-F: guest name per cell; cell background colour encodes status
//               (green = confirmed, blue = pending, white = empty/cancelled)
//
//   "Bookings" tab (master list, one row per booking):
//     Row 1 headers exactly:
//       Booking ID | Room | Guest Name | Email | Phone | Check-in | Check-out |
//       Adults | Children | Pets | Veg Meals | Non-Veg Meals | Total Price |
//       Status | Payment Status
//     Row 2+: one row per booking. Leave "Booking ID" blank on a new row to
//     create a new booking — this script will fill it in automatically once
//     the backend creates the record.
// ════════════════════════════════════════════════════════════════════════════

const BACKEND_URL   = 'https://YOUR-BACKEND-URL.example.com'; // ← set me, no trailing slash
const SHEETS_SECRET = 'YOUR_SHEETS_WEBHOOK_SECRET';           // ← must match backend .env

const BOOKINGS_SHEET_NAME = 'Bookings';

// Must match backend/src/utils/googleSheets.js ROOM_COLUMN_INDEX
const ROOM_COLUMN_INDEX = {
  'Cozy 1':                2,
  'Cozy 2':                3,
  'Cozy Mini':             4,
  'Dormitory (Open Loft)': 5,
  'Pent House':            6,
};

const STATUS_COLORS = {
  confirmed: '#b6d7a8',
  pending:   '#a4c2f4',
  cancelled: '#ffffff',
};

const BOOKINGS_HEADERS = [
  'Booking ID', 'Room', 'Guest Name', 'Email', 'Phone',
  'Check-in', 'Check-out', 'Adults', 'Children', 'Pets',
  'Veg Meals', 'Non-Veg Meals', 'Total Price', 'Status', 'Payment Status',
];

// ── doPost — backend → sheet ────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.secret !== SHEETS_SECRET) {
      return jsonResponse({ ok: false, error: 'Invalid secret' });
    }

    switch (payload.action) {
      case 'upsert':
        upsertCalendarBooking(payload);
        break;
      case 'clear':
        clearCalendarBooking(payload);
        break;
      case 'bulkUpsert':
        (payload.items || []).forEach(upsertCalendarBooking);
        break;
      case 'upsertBooking':
        upsertBookingRow(payload.booking);
        break;
      case 'bulkUpsertBookings':
        (payload.items || []).forEach(upsertBookingRow);
        break;
      default:
        return jsonResponse({ ok: false, error: `Unknown action: ${payload.action}` });
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Calendar tab helpers ─────────────────────────────────────────────────────

function getMonthTab(ss, dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const tabName = `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  return ss.getSheetByName(tabName);
}

function dateRange(startStr, endStr) {
  // endStr is exclusive (checkout day)
  const dates = [];
  const cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (cur < end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function findRowForDate(sheet, date) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const dateCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const target = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  for (let i = 0; i < dateCol.length; i++) {
    const v = dateCol[i][0];
    if (!v) continue;
    const cellDate = Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (cellDate === target) return i + 2; // sheet row number
  }
  return -1;
}

function upsertCalendarBooking(payload) {
  const { roomName, guestName, startDate, endDate, status } = payload;
  const col = ROOM_COLUMN_INDEX[roomName];
  if (!col) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dates = dateRange(startDate, endDate);
  const color = STATUS_COLORS[status] || STATUS_COLORS.pending;

  dates.forEach((d) => {
    const sheet = getMonthTab(ss, Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
    if (!sheet) return;
    const row = findRowForDate(sheet, d);
    if (row === -1) return;
    const cell = sheet.getRange(row, col);
    cell.setValue(guestName || '');
    cell.setBackground(color);
  });
}

function clearCalendarBooking(payload) {
  const { roomName, startDate, endDate } = payload;
  const col = ROOM_COLUMN_INDEX[roomName];
  if (!col) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dates = dateRange(startDate, endDate);

  dates.forEach((d) => {
    const sheet = getMonthTab(ss, Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
    if (!sheet) return;
    const row = findRowForDate(sheet, d);
    if (row === -1) return;
    const cell = sheet.getRange(row, col);
    cell.setValue('');
    cell.setBackground(STATUS_COLORS.cancelled);
  });
}

// ── Bookings tab helpers ─────────────────────────────────────────────────────

function getBookingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(BOOKINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(BOOKINGS_SHEET_NAME);
    sheet.getRange(1, 1, 1, BOOKINGS_HEADERS.length).setValues([BOOKINGS_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function bookingToRow(b) {
  return [
    b.bookingId || '',
    b.roomName || '',
    b.guestName || '',
    b.email || '',
    b.phone || '',
    b.checkIn || '',
    b.checkOut || '',
    b.adults ?? '',
    b.children ?? '',
    b.pets ?? '',
    b.vegMeals ?? '',
    b.nonVegMeals ?? '',
    b.totalPrice ?? '',
    b.status || '',
    b.paymentStatus || '',
  ];
}

function findBookingRow(sheet, bookingId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(bookingId)) return i + 2;
  }
  return -1;
}

function upsertBookingRow(b) {
  if (!b || !b.bookingId) return;
  const sheet = getBookingsSheet();
  const row = findBookingRow(sheet, b.bookingId);
  const values = bookingToRow(b);

  if (row === -1) {
    sheet.appendRow(values);
  } else {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  }
}

// ── onEdit — sheet → backend ────────────────────────────────────────────────
// Installed as an installable trigger (run setupTriggers() once) so it can
// make external HTTP requests, which simple onEdit triggers cannot do.
function onEditInstallable(e) {
  try {
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();

    if (row === 1) return; // ignore header edits

    if (sheetName === BOOKINGS_SHEET_NAME) {
      handleBookingsRowEdit(sheet, row);
    } else if (isCalendarMonthTab(sheetName)) {
      handleCalendarColumnEdit(sheet, sheetName, e.range.getColumn());
    }
  } catch (err) {
    console.error('onEdit error: ' + err.message);
  }
}

function isCalendarMonthTab(name) {
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const parts = name.trim().toLowerCase().split(/\s+/);
  return parts.length === 2 && monthNames.includes(parts[0]) && /^\d{2}$/.test(parts[1]);
}

// ── Bookings tab edit → /api/sync/bookings-inbound ─────────────────────────
function handleBookingsRowEdit(sheet, row) {
  const values = sheet.getRange(row, 1, 1, BOOKINGS_HEADERS.length).getValues()[0];

  // Skip completely empty rows
  if (values.every((v) => v === '' || v === null)) return;

  const payload = {
    secret:        SHEETS_SECRET,
    bookingId:     values[0] ? String(values[0]) : '',
    roomName:      values[1],
    guestName:     values[2],
    email:         values[3],
    phone:         values[4],
    checkIn:       formatDateCell(values[5]),
    checkOut:      formatDateCell(values[6]),
    adults:        values[7],
    children:      values[8],
    pets:          values[9],
    vegMeals:      values[10],
    nonVegMeals:   values[11],
    totalPrice:    values[12],
    status:        values[13],
    paymentStatus: values[14],
  };

  const res = UrlFetchApp.fetch(`${BACKEND_URL}/api/sync/bookings-inbound`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const body = JSON.parse(res.getContentText() || '{}');

  // If this was a new row (no bookingId), write the generated id back
  if (body.ok && body.bookingId && !payload.bookingId) {
    sheet.getRange(row, 1).setValue(body.bookingId);
  }
}

function formatDateCell(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
}

// ── Calendar tab edit → /api/sync/inbound ───────────────────────────────────
function handleCalendarColumnEdit(sheet, sheetName, col) {
  let roomName = null;
  for (const [name, idx] of Object.entries(ROOM_COLUMN_INDEX)) {
    if (idx === col) { roomName = name; break; }
  }
  if (!roomName) return; // edit was outside a room column (e.g. date column)

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const dateValues  = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const cellRange   = sheet.getRange(2, col, lastRow - 1, 1);
  const cellValues  = cellRange.getValues();
  const cellColors  = cellRange.getBackgrounds();

  const cells = dateValues.map((d, i) => ({
    date:  formatDateCell(d[0]),
    value: cellValues[i][0] || '',
    color: cellColors[i][0] || '#ffffff',
  })).filter((c) => c.date);

  const payload = {
    secret: SHEETS_SECRET,
    sheetName,
    roomName,
    cells,
  };

  UrlFetchApp.fetch(`${BACKEND_URL}/api/sync/inbound`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

// ── One-time setup ───────────────────────────────────────────────────────────
// Run this once from the Apps Script editor to install the installable onEdit
// trigger (simple onEdit triggers can't call UrlFetchApp).
function setupTriggers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Remove any existing onEditInstallable triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'onEditInstallable') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // Make sure the Bookings tab exists with correct headers
  getBookingsSheet();
}
