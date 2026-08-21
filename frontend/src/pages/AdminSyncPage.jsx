import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import SectionHeader from '../components/SectionHeader';

function StatusRow({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm border-b border-white/5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`font-medium ${ok ? 'text-lime-300' : 'text-rose-400'}`}>
        {value}
      </span>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white flex items-center gap-1"
    >
      {copied ? 'Copied!' : <><ClipboardDocumentIcon className="h-3.5 w-3.5" /> Copy</>}
    </button>
  );
}

// The canonical script lives at sheets/BowlineSync.gs — this copy is what the
// admin pastes into Apps Script, so the two must stay identical.
const APPS_SCRIPT_CODE = `// ── Bowline × Google Sheets — bidirectional booking sync ───────────────────
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
  pending:        '#ffffff',
  blocked:        '#e06666'
};

var WEEKEND_DATE_COLOR = '#fff2cc';
var DATE_DISPLAY_FORMAT = 'dd-ddd-yyyy';

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

    } else if (data.action === 'upsertBooking') {
      upsertBookingRow(data.booking);
      result.action = 'upsertBooking';

    } else if (data.action === 'bulkUpsertBookings') {
      var rows = data.items || [];
      for (var r = 0; r < rows.length; r++) {
        upsertBookingRow(rows[r]);
      }
      result.action = 'bulkUpsertBookings';
      result.count = rows.length;

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

// ── Write / update a row in the "Bookings" tab ──────────────────────────────
// Column order must match BOOKING_SHEET_HEADERS in backend/src/utils/googleSheets.js.
var BOOKINGS_SHEET = 'Bookings';
var BOOKINGS_HEADERS = [
  'Booking ID', 'Room', 'Guest Name', 'Email', 'Phone',
  'Check-in', 'Check-out', 'Adults', 'Children', 'Pets',
  'Total Price', 'Status', 'Payment Status'
];

function getBookingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(BOOKINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(BOOKINGS_SHEET);
    sheet.getRange(1, 1, 1, BOOKINGS_HEADERS.length).setValues([BOOKINGS_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertBookingRow(b) {
  if (!b || !b.bookingId) return;

  var sheet = getBookingsSheet();
  var values = [
    b.bookingId, b.roomName || '', b.guestName || '', b.email || '', b.phone || '',
    b.checkIn || '', b.checkOut || '', b.adults, b.children, b.pets,
    b.totalPrice, b.status || '', b.paymentStatus || ''
  ];

  var lastRow = sheet.getLastRow();
  var row = -1;
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(b.bookingId)) { row = i + 2; break; }
    }
  }

  if (row === -1) {
    sheet.appendRow(values);
  } else {
    sheet.getRange(row, 1, 1, values.length).setValues([values]);
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
    if (!sheetName.match(/^[A-Za-z]{3} \\d{2}$/)) return;

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
    if (!sheetName.match(/^[A-Za-z]{3} \\d{2}$/)) continue;

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
    if (!sheet.getName().match(/^[A-Za-z]{3} \\d{2}$/)) continue;
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
}`;

function AdminSyncPage() {
  const [status, setStatus]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [pushing, setPushing]         = useState(false);
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    document.title = 'Bowline Admin | Sheets Sync';
    api.get('/sync/status')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ configured: false }))
      .finally(() => setLoading(false));
  }, []);

  const handlePush = async () => {
    setPushing(true);
    try {
      const { data } = await api.post('/sync/push');
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Push failed');
    } finally {
      setPushing(false);
    }
  };

  const handleImportLegacy = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await api.post('/sync/import-legacy');
      setImportResult(data);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin.replace(/:\d+$/, '')}/api/sync/inbound`
    : 'https://your-domain.vercel.app/api/sync/inbound';

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Google Sheets Sync"
        title="Bidirectional booking sync"
        description="Apps Script only — no Google Cloud required."
      />

      {/* ── Legacy import ───────────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] p-6 space-y-4 border border-amber-400/20">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <DocumentArrowUpIcon className="h-5 w-5 text-amber-300" />
          Import Legacy Data — BNS 2026 Spreadsheet
        </h2>
        <p className="text-sm text-slate-400">
          Imports all 110 bookings from <strong className="text-slate-200">BNS Calender 2026.xlsx</strong> into
          the product (Jan–Jul 2026, all 5 rooms). Already-existing bookings are skipped — safe to run multiple times.
        </p>

        <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-slate-200 mb-2">What will be imported:</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
            {[
              ['Cozy 1', '32 bookings'],
              ['Cozy 2', '18 bookings'],
              ['Cozy Mini', '15 bookings'],
              ['Dormitory', '6 bookings'],
              ['Pent House', '39 bookings'],
            ].map(([room, count]) => (
              <div key={room} className="flex justify-between">
                <span className="text-slate-400">{room}</span>
                <span className="text-lime-300 font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn-primary w-full"
          onClick={handleImportLegacy}
          disabled={importing}
        >
          {importing ? 'Importing…' : 'Import 110 Bookings into Product'}
        </button>

        {importResult && (
          <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-sm space-y-1.5">
            <p className="font-semibold text-white">{importResult.message}</p>
            <div className="text-xs text-slate-400 space-y-0.5">
              <p><span className="text-lime-300 font-semibold">{importResult.created}</span> new bookings created</p>
              <p><span className="text-slate-400 font-semibold">{importResult.skipped}</span> already existed (skipped)</p>
              {importResult.errors?.length > 0 && (
                <div className="mt-2 text-rose-400">
                  <p>{importResult.errors.length} errors:</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
                    {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Connection status ────────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] p-6 space-y-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <SignalIcon className="h-5 w-5 text-slate-400" />
          Connection Status
        </h2>

        {loading ? (
          <p className="text-sm text-slate-500">Checking configuration…</p>
        ) : (
          <>
            <StatusRow
              label="Apps Script web app URL"
              value={status?.configured ? 'Set' : 'Not set'}
              ok={status?.configured}
            />
            <StatusRow
              label="Webhook secret"
              value={status?.appsScriptUrl ? '(set)' : status?.configured ? '(set)' : 'Not set'}
              ok={status?.configured}
            />
            {!status?.configured && (
              <div className="mt-3 rounded-[1.25rem] border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-300">
                <p className="font-semibold flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Add these two environment variables in Vercel to enable sync:
                </p>
                <ul className="mt-2 space-y-1 font-mono text-xs text-amber-200">
                  <li>APPS_SCRIPT_WEB_APP_URL</li>
                  <li>SHEETS_WEBHOOK_SECRET</li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Push app → sheet ─────────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] p-6 space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <ArrowUpTrayIcon className="h-5 w-5 text-lime-300" />
          Push App → Sheet
        </h2>
        <p className="text-sm text-slate-400">
          Sends all pending and confirmed room bookings from the database to your Google Sheet via Apps Script.
          Use this for a full resync after changes.
        </p>
        <button
          className="btn-primary w-full"
          onClick={handlePush}
          disabled={pushing || !status?.configured}
        >
          {pushing ? 'Pushing…' : 'Push All Bookings to Sheet'}
        </button>
      </div>

      {/* ── Apps Script setup guide ──────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">Apps Script Setup</h2>
        <p className="text-sm text-slate-400">
          Paste the code below into your Google Sheet via{' '}
          <strong className="text-slate-200">Extensions → Apps Script</strong>.
          It handles both directions: sheet edits call your backend, and your backend writes
          back to the sheet via the deployed web app.
        </p>

        <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
          <span>Your inbound webhook URL:</span>
          <code className="rounded-lg bg-white/5 px-3 py-1 text-xs text-lime-300 break-all">{webhookUrl}</code>
          <CopyButton text={webhookUrl} />
        </div>

        <div className="relative">
          <div className="absolute top-3 right-3 z-10">
            <CopyButton text={APPS_SCRIPT_CODE} />
          </div>
          <pre className="overflow-x-auto rounded-[1.5rem] bg-[#050e08] p-5 text-xs text-slate-300 leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap">
            {APPS_SCRIPT_CODE}
          </pre>
        </div>

        <div className="rounded-[1.25rem] border border-lime-400/20 bg-lime-400/5 p-4 text-sm space-y-2">
          <p className="font-semibold text-lime-300 flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4" />
            Setup checklist
          </p>
          <ol className="space-y-1.5 text-slate-300 list-decimal list-inside text-xs">
            <li>Open your Google Sheet → Extensions → Apps Script → paste the code above into Code.gs</li>
            <li>Replace <code className="text-slate-200">WEBHOOK_URL</code> with your Vercel domain and <code className="text-slate-200">WEBHOOK_SECRET</code> with a random secret</li>
            <li>
              Deploy as a web app: <strong className="text-slate-200">Deploy → New deployment → Web app</strong>,
              execute as <em>Me</em>, access <em>Anyone</em>
            </li>
            <li>Copy the <code className="text-slate-200">/exec</code> URL → add as <code className="text-slate-200">APPS_SCRIPT_WEB_APP_URL</code> in Vercel</li>
            <li>Add the same secret as <code className="text-slate-200">SHEETS_WEBHOOK_SECRET</code> in Vercel</li>
            <li>Add an onEdit trigger: Triggers → Add Trigger → <code className="text-slate-200">onEdit</code> → From spreadsheet → On edit</li>
            <li>Click <strong className="text-slate-200">Push All Bookings to Sheet</strong> above to seed the sheet with existing bookings</li>
            <li>In the sheet, use the <strong className="text-slate-200">Bowline → Sync All to App</strong> menu to do a one-time import from sheet to app</li>
          </ol>
        </div>
      </div>

      {/* ── Color legend ─────────────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] p-6 space-y-3">
        <h2 className="text-base font-semibold text-white">Cell Color Legend</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
          {[
            { color: '#b6d7a8', label: 'Confirmed, paid in full' },
            { color: '#ffe599', label: 'Confirmed, 50% deposit (balance due)' },
            { color: '#e06666', label: 'Blocked — unavailable to guests' },
            { color: '#ffffff', label: 'Empty / Pending / Cancelled', border: true },
          ].map((item) => (
            <div key={item.color} className="flex items-center gap-2">
              <span
                className="h-5 w-5 flex-shrink-0 rounded border border-white/20"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-300 text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminSyncPage;
