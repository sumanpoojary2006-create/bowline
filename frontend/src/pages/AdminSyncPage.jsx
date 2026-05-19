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

const APPS_SCRIPT_CODE = `// ── Bowline × Google Sheets — bidirectional booking sync ───────────────────
//
// SETUP INSTRUCTIONS
// 1. Open your Google Sheet
// 2. Extensions → Apps Script → paste this entire file into Code.gs
// 3. Replace WEBHOOK_URL and WEBHOOK_SECRET with your actual values
// 4. Deploy as web app:
//      Deploy → New deployment → Web app
//      Execute as: Me  |  Who has access: Anyone
//      Copy the /exec URL → set as APPS_SCRIPT_WEB_APP_URL in Vercel
// 5. Add onEdit trigger:
//      Triggers → Add Trigger → onEdit → From spreadsheet → On edit
//
// SHEET STRUCTURE
// Row 1 : Date | Cozy 1 | Cozy 2 | Cozy Mini | Dormitory (Open Loft) | Pent House
// Row 2+: One row per calendar day  |  Cell value = guest name  |  background = status
//
// COLOURS
// #b6d7a8  Confirmed    #a4c2f4  Pending    #ffffff  Empty / Cancelled

var WEBHOOK_URL    = 'https://YOUR_DOMAIN.vercel.app/api/sync/inbound';
var WEBHOOK_SECRET = 'YOUR_SHEETS_WEBHOOK_SECRET';

var ROOM_COLUMNS = {
  2: 'Cozy 1',
  3: 'Cozy 2',
  4: 'Cozy Mini',
  5: 'Dormitory (Open Loft)',
  6: 'Pent House'
};

var STATUS_COLORS = { confirmed: '#b6d7a8', pending: '#a4c2f4' };

// ── App → Sheet : doPost ─────────────────────────────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.secret !== WEBHOOK_SECRET) {
      return json({ ok: false, error: 'Invalid secret' });
    }
    if (data.action === 'upsert') {
      upsertBookingCells(data.roomName, data.startDate, data.endDate, data.guestName, data.status);
    } else if (data.action === 'clear') {
      clearBookingCells(data.roomName, data.startDate, data.endDate);
    } else if (data.action === 'bulkUpsert') {
      (data.items || []).forEach(function(item) {
        upsertBookingCells(item.roomName, item.startDate, item.endDate, item.guestName, item.status);
      });
    }
    return json({ ok: true, action: data.action });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

function upsertBookingCells(roomName, startDateStr, endDateStr, guestName, status) {
  var col   = getRoomColumn(roomName);
  if (!col) return;
  var color = STATUS_COLORS[status] || STATUS_COLORS['pending'];
  var d     = new Date(startDateStr);
  var end   = new Date(endDateStr);
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

function clearBookingCells(roomName, startDateStr, endDateStr) {
  var col = getRoomColumn(roomName);
  if (!col) return;
  var d   = new Date(startDateStr);
  var end = new Date(endDateStr);
  while (d < end) {
    var sheet = getMonthSheet(d);
    if (sheet) {
      var row = getRowForDate(sheet, d);
      if (row > 0) {
        sheet.getRange(row, col).clearContent().setBackground('#ffffff');
      }
    }
    d.setDate(d.getDate() + 1);
  }
}

// ── Sheet → App : onEdit ─────────────────────────────────────────────────────
function onEdit(e) {
  try {
    var range     = e.range;
    var sheet     = range.getSheet();
    var col       = range.getColumn();
    var sheetName = sheet.getName();
    if (col < 2 || col > 6 || !ROOM_COLUMNS[col]) return;
    if (!sheetName.match(/^[A-Za-z]{3} \\d{2}$/)) return;
    syncColumn(sheet, sheetName, col);
  } catch (err) { Logger.log('onEdit error: ' + err.message); }
}

function syncColumn(sheet, sheetName, col) {
  var roomName = ROOM_COLUMNS[col];
  var lastRow  = sheet.getLastRow();
  if (lastRow < 2) return;
  var numRows    = lastRow - 1;
  var dateValues = sheet.getRange(2, 1, numRows, 1).getValues();
  var cellValues = sheet.getRange(2, col, numRows, 1).getValues();
  var cellColors = sheet.getRange(2, col, numRows, 1).getBackgrounds();
  var tz = Session.getScriptTimeZone();
  var cells = [];
  for (var i = 0; i < numRows; i++) {
    var raw = dateValues[i][0];
    if (!raw) continue;
    var dateStr = Utilities.formatDate(new Date(raw), tz, 'yyyy-MM-dd');
    if (!dateStr || dateStr === 'NaN-aN-aN') continue;
    cells.push({ date: dateStr, value: (cellValues[i][0] || '').toString().trim(), color: cellColors[i][0] || '#ffffff' });
  }
  if (cells.length === 0) return;
  var payload = JSON.stringify({ sheetName: sheetName, roomName: roomName, cells: cells, secret: WEBHOOK_SECRET });
  var response = UrlFetchApp.fetch(WEBHOOK_URL, { method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true });
  Logger.log('[Bowline] ' + sheetName + '/' + roomName + ' → ' + response.getResponseCode() + ': ' + response.getContentText());
}

// ── Manual sync + custom menu ────────────────────────────────────────────────
function syncAllRooms() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (!name.match(/^[A-Za-z]{3} \\d{2}$/)) return;
    for (var col = 2; col <= 6; col++) {
      if (!ROOM_COLUMNS[col]) continue;
      try { syncColumn(sheet, name, col); Utilities.sleep(300); } catch (err) { Logger.log(err.message); }
    }
  });
  SpreadsheetApp.getUi().alert('Sync complete!');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Bowline').addItem('Sync All to App', 'syncAllRooms').addToUi();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function getRoomColumn(roomName) { for (var c in ROOM_COLUMNS) { if (ROOM_COLUMNS[c] === roomName) return parseInt(c, 10); } return null; }
var MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function sheetNameForDate(d) { return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2); }
function getMonthSheet(d) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetNameForDate(d)); }
function getOrCreateMonthSheet(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = sheetNameForDate(d);
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  sheet.getRange(1,1).setValue('Date');
  for (var c in ROOM_COLUMNS) { sheet.getRange(1, parseInt(c,10)).setValue(ROOM_COLUMNS[c]); }
  var year = d.getFullYear(), month = d.getMonth(), days = new Date(year, month+1, 0).getDate();
  for (var i = 1; i <= days; i++) { sheet.getRange(i+1, 1).setValue(new Date(year, month, i)); }
  sheet.getRange(2,1,days,1).setNumberFormat('d mmm');
  return sheet;
}
function getRowForDate(sheet, date) {
  var target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var dates = sheet.getRange(2, 1, lastRow-1, 1).getValues();
  for (var i = 0; i < dates.length; i++) {
    var c = dates[i][0];
    if (!c) continue;
    if (new Date(c.getFullYear(), c.getMonth(), c.getDate()).getTime() === target) return i+2;
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
            { color: '#b6d7a8', label: 'Confirmed (blocked on OTAs)' },
            { color: '#a4c2f4', label: 'Pending / not yet blocked' },
            { color: '#ffffff', label: 'Empty / Cancelled', border: true },
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
