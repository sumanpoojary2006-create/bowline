// ── Bowline × Google Sheets — bidirectional booking sync ───────────────────
//
// SETUP INSTRUCTIONS
// ──────────────────
// 1. Open your Google Sheet
// 2. Extensions → Apps Script → paste this entire file into Code.gs
// 3. Replace WEBHOOK_URL and WEBHOOK_SECRET with your values
// 4. Save, then: Triggers → Add Trigger
//      Function: onEdit | Event source: From spreadsheet | Event type: On edit
// 5. Authorize when prompted
//
// SHEET STRUCTURE EXPECTED
// ────────────────────────
// Row 1  : Headers  → Date | Cozy 1 | Cozy 2 | Cozy Mini | Dorm | Penthouse
// Row 2+ : One row per calendar day of the month
// Cell value = Guest name when booked, empty when free
// Cell background = booking status colour (see legend below)
//
// STATUS COLOURS
// ──────────────
// #b6d7a8  Confirmed (dates blocked)
// #a4c2f4  Pending / Confirmed but not yet blocked on OTAs
// #ffe599  Tentative
// #ffffff  Empty / Cancelled
// ───────────────────────────────────────────────────────────────────────────

var WEBHOOK_URL    = 'https://YOUR_DOMAIN.vercel.app/api/sync/inbound';
var WEBHOOK_SECRET = 'YOUR_SHEETS_WEBHOOK_SECRET'; // must match SHEETS_WEBHOOK_SECRET env var

// Column index → room name (must match Listing names in Bowline database exactly)
var ROOM_COLUMNS = {
  2: 'Cozy 1',
  3: 'Cozy 2',
  4: 'Cozy Mini',
  5: 'Dorm',
  6: 'Penthouse'
};

// ── Main trigger ────────────────────────────────────────────────────────────
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

  var payload = JSON.stringify({ sheetName: sheetName, roomName: roomName, cells: cells });
  var options = {
    method:          'post',
    contentType:     'application/json',
    payload:         payload,
    headers:         { 'x-sync-secret': WEBHOOK_SECRET },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
  var code     = response.getResponseCode();
  var body     = response.getContentText();

  Logger.log('[Bowline Sync] ' + sheetName + ' / ' + roomName + ' → HTTP ' + code + ': ' + body);
}

// ── Manual full-sheet sync (run this from the Apps Script editor) ───────────
// Useful for a first-time import of existing sheet data into Bowline.
function syncAllRooms() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
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
}
