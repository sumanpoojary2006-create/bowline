// ── Bowline × Google Sheets — bidirectional booking sync ───────────────────
//
// SETUP INSTRUCTIONS
// ──────────────────
// 1. Open your Google Sheet
// 2. Extensions → Apps Script → paste this entire file into Code.gs
// 3. Replace WEBHOOK_URL and set WEBHOOK_SECRET in Apps Script project properties
// 4. Deploy as web app:
//      Deploy → New deployment → Web app
//      Execute as: Me | Who has access: Anyone
//      Copy the /exec URL → set as APPS_SCRIPT_WEB_APP_URL in Vercel
// 5. Add onEdit trigger:
//      Triggers → Add Trigger
//      Function: onEdit | Event source: From spreadsheet | Event type: On edit
// 6. Authorize when prompted
//
// SHEET STRUCTURE EXPECTED
// ────────────────────────
// Month tabs ("Jan 26", "Feb 26", …):
//   Row 1  : Headers  → Date | Cozy 1 | Cozy 2 | Cozy Mini | Dormitory | Pent House
//   Row 2+ : One row per calendar day of the month
//   Cell value = Guest name when booked, empty when free
//   Cell background = booking status colour (see legend below)
//
// "Bookings" tab: one row per booking, created automatically on first write.
//
// STATUS COLOURS
// ──────────────
// #b6d7a8  Confirmed, paid in full (green)
// #ffe599  Confirmed with a 50% deposit — balance still due (yellow)
// #ffffff  Pending / unconfirmed / cancelled — name only, no colour
// #e06666  Blocked by admin — room unavailable to guests (red)
// ───────────────────────────────────────────────────────────────────────────

var WEBHOOK_URL = 'https://bowline-omega.vercel.app/api/sync/inbound';
var WEBHOOK_SECRET = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET') ||
  'YOUR_SHEETS_WEBHOOK_SECRET'; // set WEBHOOK_SECRET in Apps Script project properties

// Column index → room name (must match Listing names in Bowline database exactly)
var ROOM_COLUMNS = {
  2: 'Cozy 1',
  3: 'Cozy 2',
  4: 'Cozy Mini',
  5: 'Dormitory',
  6: 'Pent House'
};

var STATUS_COLORS = {
  confirmed:      '#b6d7a8',
  partially_paid: '#ffe599',
  pending:        '#ffffff',
  blocked:        '#e06666'
};

var WEEKEND_DATE_COLOR = '#fff2cc';
var DATE_DISPLAY_FORMAT = 'dd-ddd-yyyy';

// ── App → Sheet: doPost handler ─────────────────────────────────────────────
// Receives POST from Bowline backend when a booking is created/updated/cancelled.
// Actions: upsert | clear | bulkUpsert
function doPost(e) {
  var lock = null;
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.secret !== WEBHOOK_SECRET) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Invalid secret' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Vercel can deliver writes from several server instances at once.
    // Serialize them inside Apps Script so append/update operations cannot
    // collide and silently lose a booking.
    lock = LockService.getScriptLock();
    lock.waitLock(30000);

    var result = { ok: true };

    if (data.action === 'upsertLaundry') {
      upsertLaundrySubmission(data.submission);
      result.action = 'upsertLaundry';

    } else if (data.action === 'upsert') {
      upsertBookingCells(data.roomName, data.startDate, data.endDate, data.guestName, data.status, data.color);
      result.action = 'upsert';

    } else if (data.action === 'clear') {
      clearBookingCells(data.roomName, data.startDate, data.endDate);
      result.action = 'clear';

    } else if (data.action === 'bulkUpsert') {
      var items = data.items || [];
      bulkUpsertBookingCells(items);
      result.action = 'bulkUpsert';
      result.count = items.length;

    } else if (data.action === 'upsertBooking') {
      upsertBookingRow(data.booking);
      result.action = 'upsertBooking';

    } else if (data.action === 'bulkUpsertBookings') {
      var rows = data.items || [];
      bulkUpsertBookingRows(rows);
      result.action = 'bulkUpsertBookings';
      result.count = rows.length;

    } else if (data.action === 'upsertContact') {
      upsertWhatsAppContact(data.phone, data.profileName, data.firstSeenAt, data.lastSeenAt, data.messageCount);
      result.action = 'upsertContact';

    } else if (data.action === 'upsertAttendance') {
      upsertAttendanceRecord(data);
      result.action = 'upsertAttendance';

    } else if (data.action === 'upsertSalarySummary') {
      upsertSalarySummaryRow(data);
      result.action = 'upsertSalarySummary';

    } else {
      result.ok = false;
      result.error = 'Unknown action: ' + data.action;
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

// ── Write booking cells into the sheet ──────────────────────────────────────
function upsertBookingCells(roomName, startDateStr, endDateStr, guestName, status, colorOverride) {
  var col = getRoomColumn(roomName);
  if (!col) return;

  var start = parseDateOnly(startDateStr);
  var end   = parseDateOnly(endDateStr);
  var color = colorOverride || STATUS_COLORS[status] || '#ffffff';

  // Iterate over each day in [start, end)
  var d = new Date(start);
  while (d < end) {
    var sheet = getOrCreateMonthSheet(d);
    if (sheet) {
      clearCalendarStrikethrough(sheet);
      var row = getRowForDate(sheet, d);
      if (row > 0) {
        var cell = sheet.getRange(row, col);
        cell.setValue(guestName);
        cell.setBackground(color);
      }
    }
    d.setDate(d.getDate() + 1);
  }
}

// Apply a complete calendar resync with one read and one write per month.
// The older implementation performed several Spreadsheet service calls per
// occupied night and timed out on a full production dataset.
function bulkUpsertBookingCells(items) {
  var months = {};

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var col = getRoomColumn(item.roomName);
    if (!col) continue;

    var start = parseDateOnly(item.startDate);
    var end = parseDateOnly(item.endDate);
    var color = STATUS_COLORS[item.status] || '#ffffff';
    var d = new Date(start);

    while (d < end) {
      var name = sheetNameForDate(d);
      if (!months[name]) months[name] = { date: new Date(d), updates: [] };
      months[name].updates.push({
        row: d.getDate() - 1,
        col: col - 2,
        value: item.guestName || '',
        color: color
      });
      d.setDate(d.getDate() + 1);
    }
  }

  for (var sheetName in months) {
    var month = months[sheetName];
    var sheet = getOrCreateMonthSheet(month.date);
    clearCalendarStrikethrough(sheet);
    var numRows = sheet.getLastRow() - 1;
    if (numRows < 1) continue;

    var range = sheet.getRange(2, 2, numRows, 5);
    var values = range.getValues();
    var backgrounds = range.getBackgrounds();

    for (var u = 0; u < month.updates.length; u++) {
      var update = month.updates[u];
      if (update.row < 0 || update.row >= numRows) continue;
      values[update.row][update.col] = update.value;
      backgrounds[update.row][update.col] = update.color;
    }

    range.setValues(values);
    range.setBackgrounds(backgrounds);
  }
}

// ── Clear booking cells from the sheet ──────────────────────────────────────
function clearBookingCells(roomName, startDateStr, endDateStr) {
  var col = getRoomColumn(roomName);
  if (!col) return;

  var start = parseDateOnly(startDateStr);
  var end   = parseDateOnly(endDateStr);

  var d = new Date(start);
  while (d < end) {
    var sheet = getMonthSheet(d);
    if (sheet) {
      clearCalendarStrikethrough(sheet);
      var row = getRowForDate(sheet, d);
      if (row > 0) {
        var cell = sheet.getRange(row, col);
        cell.clearContent();
        cell.setBackground('#ffffff');
      }
    }
    d.setDate(d.getDate() + 1);
  }
}

// ── Write / update a row in the "Bookings" tab ──────────────────────────────
// Column order must match BOOKING_SHEET_HEADERS in backend/src/utils/googleSheets.js.
var BOOKINGS_SHEET = 'Bookings';
var BOOKINGS_HEADERS = [
  'Booking ID', 'Room', 'Guest Name', 'Email', 'Phone',
  'Check-in', 'Check-out', 'Adults', 'Children', 'Pets',
  'Veg Meals', 'Non-Veg Meals', 'Total Price', 'Status', 'Payment Status'
];

function getBookingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(BOOKINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(BOOKINGS_SHEET);
  }
  // Keep existing sheets on the canonical layout too. This repairs older
  // 13-column installations without moving or deleting historical meal data.
  sheet.getRange(1, 1, 1, BOOKINGS_HEADERS.length).setValues([BOOKINGS_HEADERS]);
  sheet.setFrozenRows(1);
  return sheet;
}

function upsertBookingRow(b) {
  if (!b || !b.bookingId) return;

  var sheet = getBookingsSheet();
  var lastRow = sheet.getLastRow();
  var row = -1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(b.bookingId)) { row = i + 2; break; }
    }
  }

  // Booking payloads do not currently own the meal counts. Preserve the
  // values already maintained in columns K/L instead of overwriting them.
  var existingMeals = row === -1 ? [0, 0] : sheet.getRange(row, 11, 1, 2).getValues()[0];
  var vegMeals = b.vegMeals === null || b.vegMeals === undefined ? (existingMeals[0] || 0) : b.vegMeals;
  var nonVegMeals = b.nonVegMeals === null || b.nonVegMeals === undefined ? (existingMeals[1] || 0) : b.nonVegMeals;
  var values = bookingRowValues(b, vegMeals, nonVegMeals);

  if (row === -1) {
    sheet.appendRow(values);
  } else {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  }
}

function bookingRowValues(b, vegMeals, nonVegMeals) {
  return [
    b.bookingId, b.roomName || '', b.guestName || '', b.email || '', b.phone || '',
    b.checkIn || '', b.checkOut || '', b.adults, b.children, b.pets,
    vegMeals, nonVegMeals, b.totalPrice, b.status || '', b.paymentStatus || ''
  ];
}

// Reconcile every booking row in memory, then write the table once. This is
// both faster and atomic from the sheet's perspective.
function bulkUpsertBookingRows(rows) {
  var sheet = getBookingsSheet();
  var lastRow = sheet.getLastRow();
  var data = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, BOOKINGS_HEADERS.length).getValues()
    : [];
  var rowById = {};

  for (var i = 0; i < data.length; i++) {
    if (data[i][0] !== '') rowById[String(data[i][0])] = i;
  }

  for (var r = 0; r < rows.length; r++) {
    var b = rows[r];
    if (!b || !b.bookingId) continue;
    var key = String(b.bookingId);
    var index = rowById[key];
    var existing = index === undefined ? null : data[index];
    var vegMeals = b.vegMeals === null || b.vegMeals === undefined
      ? ((existing && existing[10]) || 0) : b.vegMeals;
    var nonVegMeals = b.nonVegMeals === null || b.nonVegMeals === undefined
      ? ((existing && existing[11]) || 0) : b.nonVegMeals;
    var values = bookingRowValues(b, vegMeals, nonVegMeals);

    if (index === undefined) {
      rowById[key] = data.length;
      data.push(values);
    } else {
      data[index] = values;
    }
  }

  if (data.length) {
    sheet.getRange(2, 1, data.length, BOOKINGS_HEADERS.length).setValues(data);
  }
}

// ── Write / update a WhatsApp lead row in the "WhatsApp Leads" tab ──────────
var WHATSAPP_LEADS_SHEET = 'WhatsApp Leads';
var WHATSAPP_LEADS_HEADERS = ['Phone', 'Name', 'First Seen', 'Last Seen', 'Messages'];

function upsertWhatsAppContact(phone, profileName, firstSeenAt, lastSeenAt, messageCount) {
  if (!phone) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(WHATSAPP_LEADS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(WHATSAPP_LEADS_SHEET);
    sheet.getRange(1, 1, 1, WHATSAPP_LEADS_HEADERS.length).setValues([WHATSAPP_LEADS_HEADERS]);
    sheet.setFrozenRows(1);
  }

  var lastRow = sheet.getLastRow();
  var row = -1;

  if (lastRow >= 2) {
    var phones = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < phones.length; i++) {
      if (String(phones[i][0]) === String(phone)) {
        row = i + 2;
        break;
      }
    }
  }

  var firstSeen = firstSeenAt ? new Date(firstSeenAt) : new Date();
  var lastSeen = lastSeenAt ? new Date(lastSeenAt) : new Date();

  if (row === -1) {
    sheet.appendRow([phone, profileName || '', firstSeen, lastSeen, messageCount || 1]);
  } else {
    sheet.getRange(row, 2).setValue(profileName || sheet.getRange(row, 2).getValue());
    sheet.getRange(row, 4).setValue(lastSeen);
    sheet.getRange(row, 5).setValue(messageCount || 1);
  }
}

// ── Sheet → App: onEdit trigger ─────────────────────────────────────────────
function onEdit(e) {
  try {
    var range     = e.range;
    var sheet     = range.getSheet();
    var col       = range.getColumn();
    var sheetName = sheet.getName();

    // Only act on room columns (2–6) in month sheets ("Jan 26", "Feb 26", …)
    if (col < 2 || col > 6) return;
    if (!ROOM_COLUMNS[col]) return;
    if (!sheetName.match(/^[A-Za-z]{3} \d{2}$/)) return;

    syncColumn(sheet, sheetName, col);
  } catch (err) {
    Logger.log('onEdit error: ' + err.message);
  }
}

// ── Sync a full room column to Bowline ─────────────────────────────────────
function syncColumn(sheet, sheetName, col) {
  var roomName = ROOM_COLUMNS[col];
  var lastRow  = sheet.getLastRow();
  if (lastRow < 2) return;

  var numRows    = lastRow - 1;
  var dateValues = sheet.getRange(2, 1, numRows, 1).getValues();
  var cellValues = sheet.getRange(2, col, numRows, 1).getValues();
  var cellColors = sheet.getRange(2, col, numRows, 1).getBackgrounds();
  var tz         = Session.getScriptTimeZone();

  var cells = [];
  for (var i = 0; i < numRows; i++) {
    var raw = dateValues[i][0];
    if (!raw) continue;
    var dateStr = Utilities.formatDate(new Date(raw), tz, 'yyyy-MM-dd');
    if (!dateStr || dateStr === 'NaN-aN-aN') continue;
    cells.push({
      date:  dateStr,
      value: (cellValues[i][0] || '').toString().trim(),
      color: cellColors[i][0] || '#ffffff'
    });
  }

  if (cells.length === 0) return;

  var payload = JSON.stringify({
    sheetName: sheetName,
    roomName:  roomName,
    cells:     cells,
    secret:    WEBHOOK_SECRET
  });
  var options = {
    method:             'post',
    contentType:        'application/json',
    payload:            payload,
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
  var code     = response.getResponseCode();
  var body     = response.getContentText();

  Logger.log('[Bowline Sync] ' + sheetName + ' / ' + roomName + ' → HTTP ' + code + ': ' + body);
}

// ── Manual full-sheet sync (run from Apps Script editor or Bowline menu) ────
function syncAllRooms() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var sheet     = sheets[s];
    var sheetName = sheet.getName();
    if (!sheetName.match(/^[A-Za-z]{3} \d{2}$/)) continue;

    for (var col = 2; col <= 6; col++) {
      if (!ROOM_COLUMNS[col]) continue;
      try {
        syncColumn(sheet, sheetName, col);
        Utilities.sleep(300); // avoid rate limits
      } catch (err) {
        Logger.log('Error syncing ' + sheetName + ' col ' + col + ': ' + err.message);
      }
    }
  }

  Logger.log('syncAllRooms complete');
  SpreadsheetApp.getUi().alert('Sync complete! All rooms pushed to Bowline.');
}

// ── Custom menu ─────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Bowline')
    .addItem('Sync All to App', 'syncAllRooms')
    .addItem('Format Calendar Tabs', 'formatCalendarTabs')
    .addToUi();
}

function formatCalendarTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (!sheet.getName().match(/^[A-Za-z]{3} \d{2}$/)) continue;
    formatMonthSheet(sheet);
  }

  SpreadsheetApp.getUi().alert('Done! Calendar date format and weekend highlighting updated.');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Backend sends plain "YYYY-MM-DD" strings. new Date("YYYY-MM-DD") parses as
// UTC midnight per spec, but the rest of this file (sheetNameForDate,
// getRowForDate, the date column itself) all work in the script's local
// timezone — so a UTC-parsed date can read back as the previous day here,
// shifting every cell this booking touches one row earlier. Parse the Y/M/D
// components directly instead, so the result is already in local terms.
function parseDateOnly(str) {
  var parts = str.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function getRoomColumn(roomName) {
  for (var col in ROOM_COLUMNS) {
    if (ROOM_COLUMNS[col] === roomName) return parseInt(col, 10);
  }
  return null;
}

var MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function sheetNameForDate(date) {
  var yy = date.getFullYear().toString().slice(2);
  return MONTH_NAMES[date.getMonth()] + ' ' + yy;
}

function getMonthSheet(date) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var name = sheetNameForDate(date);
  return ss.getSheetByName(name);
}

function getOrCreateMonthSheet(date) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var name   = sheetNameForDate(date);
  var sheet  = ss.getSheetByName(name);
  if (sheet) return sheet;

  // Create month sheet with headers and date column
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1).setValue('Date');
  for (var col in ROOM_COLUMNS) {
    sheet.getRange(1, parseInt(col, 10)).setValue(ROOM_COLUMNS[col]);
  }

  // Fill in all days of the month
  var year  = date.getFullYear();
  var month = date.getMonth();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  for (var d = 1; d <= daysInMonth; d++) {
    sheet.getRange(d + 1, 1).setValue(new Date(year, month, d));
  }
  formatMonthSheet(sheet);

  return sheet;
}

function formatMonthSheet(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var numRows = lastRow - 1;
  var dateRange = sheet.getRange(2, 1, numRows, 1);
  var dates = dateRange.getValues();
  var backgrounds = [];

  dateRange.setNumberFormat(DATE_DISPLAY_FORMAT);
  clearCalendarStrikethrough(sheet);

  for (var i = 0; i < dates.length; i++) {
    var value = dates[i][0];
    if (value instanceof Date) {
      var day = value.getDay();
      backgrounds.push([(day === 0 || day === 6) ? WEEKEND_DATE_COLOR : '#ffffff']);
    } else {
      backgrounds.push(['#ffffff']);
    }
  }

  dateRange.setBackgrounds(backgrounds);
}

// Strike-through has no status meaning in the Bowline calendar. It can be
// applied accidentally to a row in Google Sheets and then survives value and
// colour updates, making a live booking look cancelled. Normalize it on every
// calendar write and whenever month tabs are formatted.
function clearCalendarStrikethrough(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  sheet.getRange(2, 1, lastRow - 1, 6).setFontLine('none');
}

function getRowForDate(sheet, date) {
  var target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < dates.length; i++) {
    var cell = dates[i][0];
    if (!cell) continue;
    var cellDate = new Date(cell.getFullYear(), cell.getMonth(), cell.getDate()).getTime();
    if (cellDate === target) return i + 2; // 1-indexed, offset by header row
  }
  return -1;
}

// Laundry records share this spreadsheet and the existing authenticated endpoint.
function upsertLaundrySubmission(record) {
    if (!record || !record.requestId || !/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !Array.isArray(record.rows) || !record.rows.length) throw new Error('Invalid submission');
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName('Laundry ' + record.date) || book.insertSheet('Laundry ' + record.date);
    if (!sheet.getLastRow()) {
      sheet.appendRow(['Submission ID','Date (IST)','Staff name','Item','Admin total stock','Send ↑','Received ↓','In-house stock','Submitted at']);
      sheet.setFrozenRows(1);
      sheet.getRange(1,1,1,9).setBackground('#203f37').setFontColor('#ffffff').setFontWeight('bold');
    }
    // An acknowledged or timed-out submission can be retried without duplicates.
    if (sheet.getLastRow() > 1 && sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(record.requestId).matchEntireCell(true).findNext()) return;
    var safeText = function(s) { return /^[=+@\-]/.test(String(s)) ? "'" + s : String(s); };
    var values = record.rows.map(function(r) {
      return [record.requestId,record.date,safeText(record.staffName),safeText(r.name),r.stock,r.sent,r.received,r.summary,record.createdAt];
    });
    var start = sheet.getLastRow()+1;
    sheet.getRange(start,1,values.length,9).setValues(values);
}

// ── Staff attendance — 12 month tabs (reused every year), 3 columns only ───
var ATTENDANCE_MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function attendanceSheetNameForDate(dateStr) {
  // dateStr is 'YYYY-MM-DD'; parse the month without relying on Date's
  // timezone handling of a date-only ISO string.
  var monthIndex = parseInt(dateStr.slice(5, 7), 10) - 1;
  return ATTENDANCE_MONTH_NAMES[monthIndex] || ATTENDANCE_MONTH_NAMES[0];
}

function formatAttendanceTimestamp(iso) {
  if (!iso) return '';
  return Utilities.formatDate(new Date(iso), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');
}

function getOrCreateAttendanceSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, 3).setValues([['Employee Name', 'Check-in', 'Check-out']]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  return sheet;
}

// One row per employee per shift. A check-in appends a new row with the
// check-out cell blank; the matching check-out fills in that same row
// (found by scanning upward for the most recent blank check-out for that
// employee) instead of adding a second row.
function upsertAttendanceRecord(data) {
  if (!data || !data.employeeName || !data.date) return;
  var sheet = getOrCreateAttendanceSheet(attendanceSheetNameForDate(data.date));
  var safeName = /^[=+@\-]/.test(data.employeeName) ? "'" + data.employeeName : data.employeeName;
  var checkIn = formatAttendanceTimestamp(data.checkInAt);
  var checkOut = formatAttendanceTimestamp(data.checkOutAt);

  if (checkOut) {
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
      for (var i = values.length - 1; i >= 0; i--) {
        if (values[i][0] === data.employeeName && !values[i][2]) {
          sheet.getRange(i + 2, 2, 1, 2).setValues([[checkIn || values[i][1], checkOut]]);
          return;
        }
      }
    }
  }

  sheet.appendRow([safeName, checkIn, checkOut]);
}

// ── Monthly salary summary — one tab per calendar month+year ───────────────
function salarySummarySheetName(month) {
  var parts = month.split('-');
  var monthName = ATTENDANCE_MONTH_NAMES[parseInt(parts[1], 10) - 1] || '';
  return 'Salary Summary ' + monthName + ' ' + parts[0];
}

var SALARY_SUMMARY_HEADERS = ['Employee Name', 'Full Days', 'Half Days', 'Leave Days', 'Excess Leave Days', 'Calculated Salary'];

function upsertSalarySummaryRow(data) {
  if (!data || !data.employeeName || !data.month) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = salarySummarySheetName(data.month);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, SALARY_SUMMARY_HEADERS.length).setValues([SALARY_SUMMARY_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, SALARY_SUMMARY_HEADERS.length).setFontWeight('bold');
  }

  var safeName = /^[=+@\-]/.test(data.employeeName) ? "'" + data.employeeName : data.employeeName;
  var values = [safeName, data.fullDays || 0, data.halfDays || 0, data.leaveDays || 0, data.excessLeaveDays || 0, data.calculatedSalary || 0];

  var lastRow = sheet.getLastRow();
  var row = -1;
  if (lastRow >= 2) {
    var names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      if (names[i][0] === data.employeeName) { row = i + 2; break; }
    }
  }

  if (row === -1) {
    sheet.appendRow(values);
  } else {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
  }
}
