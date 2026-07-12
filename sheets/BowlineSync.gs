// ── Bowline × Google Sheets — bidirectional booking sync ───────────────────
//
// SETUP INSTRUCTIONS
// ──────────────────
// 1. Open your Google Sheet
// 2. Extensions → Apps Script → paste this entire file into Code.gs
// 3. Replace WEBHOOK_URL and WEBHOOK_SECRET with your values
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
// Row 1  : Headers  → Date | Cozy 1 | Cozy 2 | Cozy Mini | Dormitory | Pent House
// Row 2+ : One row per calendar day of the month
// Cell value = Guest name when booked, empty when free
// Cell background = booking status colour (see legend below)
//
// STATUS COLOURS
// ──────────────
// #b6d7a8  Confirmed, paid in full (green)
// #ffe599  Confirmed with a 50% deposit — balance still due (yellow)
// #ffffff  Pending / unconfirmed / cancelled — name only, no colour
// ───────────────────────────────────────────────────────────────────────────

var WEBHOOK_URL    = 'https://bowline-omega.vercel.app/api/sync/inbound';
var WEBHOOK_SECRET = 'YOUR_SHEETS_WEBHOOK_SECRET'; // must match SHEETS_WEBHOOK_SECRET env var

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
  pending:        '#ffffff'
};

// ── App → Sheet: doPost handler ─────────────────────────────────────────────
// Receives POST from Bowline backend when a booking is created/updated/cancelled.
// Actions: upsert | clear | bulkUpsert
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.secret !== WEBHOOK_SECRET) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Invalid secret' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var result = { ok: true };

    if (data.action === 'upsert') {
      upsertBookingCells(data.roomName, data.startDate, data.endDate, data.guestName, data.status, data.color);
      result.action = 'upsert';

    } else if (data.action === 'clear') {
      clearBookingCells(data.roomName, data.startDate, data.endDate);
      result.action = 'clear';

    } else if (data.action === 'bulkUpsert') {
      var items = data.items || [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        upsertBookingCells(item.roomName, item.startDate, item.endDate, item.guestName, item.status);
      }
      result.action = 'bulkUpsert';
      result.count = items.length;

    } else if (data.action === 'upsertContact') {
      upsertWhatsAppContact(data.phone, data.profileName, data.firstSeenAt, data.lastSeenAt, data.messageCount);
      result.action = 'upsertContact';

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
    .addItem('Fix Red Cells', 'fixRedCells')
    .addToUi();
}

// ── One-time cleanup: turn every red cell white across all month sheets ────
// Red (#ea9999) was the old "pending" colour — pending is now colourless.
function fixRedCells() {
  var REDS = ['#ea9999', '#e06666', '#f4cccc', '#cc0000', '#ff0000'];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var fixed = 0;

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (!sheet.getName().match(/^[A-Za-z]{3} \d{2}$/)) continue;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) continue;

    var range = sheet.getRange(2, 2, lastRow - 1, 5); // columns B–F
    var colors = range.getBackgrounds();
    var changed = false;

    for (var r = 0; r < colors.length; r++) {
      for (var c = 0; c < colors[r].length; c++) {
        if (REDS.indexOf((colors[r][c] || '').toLowerCase()) !== -1) {
          colors[r][c] = '#ffffff';
          changed = true;
          fixed++;
        }
      }
    }

    if (changed) range.setBackgrounds(colors);
  }

  SpreadsheetApp.getUi().alert('Done! Cleared ' + fixed + ' red cell(s). Red is no longer used — green = paid, yellow = 50% deposit, no colour = pending.');
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
  sheet.getRange(2, 1, daysInMonth, 1).setNumberFormat('d mmm');

  return sheet;
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
