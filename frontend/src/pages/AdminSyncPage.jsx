import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import SectionHeader from '../components/SectionHeader';

const WEBHOOK_URL_PLACEHOLDER = 'https://your-domain.vercel.app/api/sync/inbound';

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
      className="ml-2 rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white"
    >
      {copied ? 'Copied!' : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
    </button>
  );
}

function AdminSyncPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [setupYear, setSetupYear] = useState(2026);
  const [settingUp, setSettingUp] = useState(false);
  const [pullResult, setPullResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    document.title = 'Bowline Admin | Sheets Sync';
    api.get('/sync/status')
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ configured: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleSetup = async () => {
    setSettingUp(true);
    try {
      const { data } = await api.post('/sync/setup', { year: setupYear });
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Setup failed');
    } finally {
      setSettingUp(false);
    }
  };

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

  const handlePull = async () => {
    setPulling(true);
    setPullResult(null);
    try {
      const { data } = await api.post('/sync/pull', { year: setupYear });
      setPullResult(data);
      toast.success(`Pull complete: ${data.created} created, ${data.skipped} skipped`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Pull failed');
    } finally {
      setPulling(false);
    }
  };

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin.replace(/:\d+$/, '')}/api/sync/inbound`
    : WEBHOOK_URL_PLACEHOLDER;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Google Sheets Sync"
        title="Bidirectional booking sync"
        description="Keep the Google Sheet and this app in sync automatically."
      />

      {/* Connection status */}
      <div className="glass rounded-[2rem] p-6 space-y-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Cog6ToothIcon className="h-5 w-5 text-slate-400" />
          Connection Status
        </h2>

        {loading ? (
          <p className="text-sm text-slate-500">Checking configuration…</p>
        ) : (
          <>
            <StatusRow
              label="Google Sheets configured"
              value={status?.configured ? 'Yes' : 'Missing env vars'}
              ok={status?.configured}
            />
            <StatusRow
              label="Spreadsheet ID"
              value={status?.spreadsheetId || 'Not set'}
              ok={Boolean(status?.spreadsheetId)}
            />
            {!status?.configured && (
              <div className="mt-3 rounded-[1.25rem] border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-300">
                <p className="font-semibold flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Set these environment variables in Vercel to enable sync:
                </p>
                <ul className="mt-2 space-y-1 font-mono text-xs text-amber-200">
                  <li>GOOGLE_SHEETS_ID</li>
                  <li>GOOGLE_SERVICE_ACCOUNT_EMAIL</li>
                  <li>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</li>
                  <li>SHEETS_WEBHOOK_SECRET</li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Room → Column mapping */}
      {status?.roomMapping && (
        <div className="glass rounded-[2rem] p-6 space-y-3">
          <h2 className="text-base font-semibold text-white">Room → Sheet Column Mapping</h2>
          <p className="text-sm text-slate-400">
            Room names must exactly match your Listing names in the database.
          </p>
          <div className="rounded-[1.25rem] border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Room (Listing Name)</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sheet Column</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(status.roomMapping).map(([name, { col }]) => (
                  <tr key={name} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2 text-slate-300">{name}</td>
                    <td className="px-4 py-2 font-mono text-lime-300">Column {col}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            To change the mapping, edit <code className="text-slate-300">ROOM_COLUMNS</code> in{' '}
            <code className="text-slate-300">backend/src/utils/googleSheets.js</code>.
          </p>
        </div>
      )}

      {/* Legacy import */}
      <div className="glass rounded-[2rem] p-6 space-y-4 border border-amber-400/20">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <DocumentArrowUpIcon className="h-5 w-5 text-amber-300" />
          Import Legacy Data — BNS 2026 Spreadsheet
        </h2>
        <p className="text-sm text-slate-400">
          Imports all 110 bookings parsed from the original <strong className="text-slate-200">BNS Calender 2026.xlsx</strong> file
          into the product. Covers Jan–Jul 2026 across all 5 rooms.
          Already-existing bookings are skipped so this is safe to run more than once.
        </p>

        <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-slate-200">What will be imported:</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-2">
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

      {/* Setup */}
      <div className="glass rounded-[2rem] p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">1 · Setup Sheet Structure</h2>
        <p className="text-sm text-slate-400">
          Creates all 12 month sheets with headers and date rows in your Google Sheet. Run this once when setting up a new year.
        </p>
        <div className="flex items-center gap-3">
          <select
            className="input w-32"
            value={setupYear}
            onChange={(e) => setSetupYear(Number(e.target.value))}
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            className="btn-secondary"
            onClick={handleSetup}
            disabled={settingUp || !status?.configured}
          >
            {settingUp ? 'Setting up…' : 'Create Sheet Structure'}
          </button>
        </div>
      </div>

      {/* Push / Pull */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-[2rem] p-6 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <ArrowUpTrayIcon className="h-5 w-5 text-lime-300" />
            2 · Push App → Sheet
          </h2>
          <p className="text-sm text-slate-400">
            Writes all pending and confirmed room bookings from the database into the Google Sheet. Use this to do a full resync after changes.
          </p>
          <button
            className="btn-primary w-full"
            onClick={handlePush}
            disabled={pushing || !status?.configured}
          >
            {pushing ? 'Pushing…' : 'Push All Bookings to Sheet'}
          </button>
        </div>

        <div className="glass rounded-[2rem] p-6 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <ArrowDownTrayIcon className="h-5 w-5 text-amber-300" />
            3 · Pull Sheet → App
          </h2>
          <p className="text-sm text-slate-400">
            Reads all bookings from the Google Sheet and imports any that don't exist in the database. Skips duplicates.
          </p>
          <button
            className="btn-secondary w-full"
            onClick={handlePull}
            disabled={pulling || !status?.configured}
          >
            {pulling ? 'Pulling…' : 'Pull Bookings from Sheet'}
          </button>
          {pullResult && (
            <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-3 text-xs text-slate-300 space-y-1">
              <p><span className="text-lime-300 font-semibold">{pullResult.created}</span> new bookings created</p>
              <p><span className="text-slate-400 font-semibold">{pullResult.skipped}</span> already existed (skipped)</p>
              {pullResult.errors?.length > 0 && (
                <p className="text-rose-400">{pullResult.errors.length} errors — check server logs</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Apps Script setup guide */}
      <div className="glass rounded-[2rem] p-6 space-y-4">
        <h2 className="text-base font-semibold text-white">4 · Set Up Apps Script (Realtime Sheet → App)</h2>
        <p className="text-sm text-slate-400">
          Paste the Apps Script code below into your Google Sheet via <strong className="text-slate-200">Extensions → Apps Script</strong>.
          Any time a cell is edited the script will call your backend and the booking will update automatically.
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Your webhook URL:</span>
            <code className="rounded-lg bg-white/5 px-3 py-1 text-xs text-lime-300">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
        </div>

        <div className="relative">
          <pre className="overflow-x-auto rounded-[1.5rem] bg-[#050e08] p-5 text-xs text-slate-300 leading-relaxed max-h-[480px] overflow-y-auto">
{`// ── Bowline × Google Sheets sync ──────────────────────────────────────────
// Paste this in Extensions → Apps Script → Code.gs
// Then: Triggers → Add Trigger → onEdit → Spreadsheet → On Edit

const WEBHOOK_URL = '${webhookUrl}';
const WEBHOOK_SECRET = 'YOUR_SHEETS_WEBHOOK_SECRET'; // match env var

// Column → room name mapping (must match Listing names in Bowline)
const ROOM_COLUMNS = {
  2: 'Cozy 1',
  3: 'Cozy 2',
  4: 'Cozy Mini',
  5: 'Dorm',
  6: 'Penthouse',
};

function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const col = range.getColumn();

  // Ignore edits to Date column (col 1) or unmapped columns
  if (col < 2 || col > 6) return;

  const roomName = ROOM_COLUMNS[col];
  if (!roomName) return;

  const sheetName = sheet.getName();
  // Only process month sheets (e.g. "Jan 26")
  if (!sheetName.match(/^[A-Za-z]{3} \\d{2}$/)) return;

  // Read the full column (rows 2 onwards = day 1 onwards)
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const dateValues  = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const cellValues  = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  const cellColors  = sheet.getRange(2, col, lastRow - 1, 1).getBackgrounds();

  const cells = dateValues.map((row, i) => ({
    date:  Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    value: cellValues[i][0] || '',
    color: cellColors[i][0] || '#ffffff',
  })).filter(c => c.date !== 'NaN-aN-aN');

  const payload = JSON.stringify({ sheetName, roomName, cells });

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    headers: { 'x-sync-secret': WEBHOOK_SECRET },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log('Sync response: ' + response.getContentText());
  } catch (err) {
    Logger.log('Sync error: ' + err.message);
  }
}`}
          </pre>
          <CopyButton text={`const WEBHOOK_URL = '${webhookUrl}';\nconst WEBHOOK_SECRET = 'YOUR_SHEETS_WEBHOOK_SECRET';\n// ... (copy from page)`} />
        </div>

        <div className="rounded-[1.25rem] border border-lime-400/20 bg-lime-400/5 p-4 text-sm space-y-2">
          <p className="font-semibold text-lime-300 flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4" />
            Setup checklist
          </p>
          <ol className="space-y-1.5 text-slate-300 list-decimal list-inside text-xs">
            <li>Create a Google Sheet and note its ID from the URL</li>
            <li>Create a Google Cloud service account, download the JSON key</li>
            <li>Share the sheet with the service account email (Editor access)</li>
            <li>Add <code className="text-slate-200">GOOGLE_SHEETS_ID</code>, <code className="text-slate-200">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code className="text-slate-200">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code>, <code className="text-slate-200">SHEETS_WEBHOOK_SECRET</code> to Vercel env vars</li>
            <li>Click "Create Sheet Structure" above to populate all 12 month sheets</li>
            <li>Click "Push All Bookings to Sheet" to seed existing bookings</li>
            <li>Open your Google Sheet → Extensions → Apps Script → paste the code above</li>
            <li>In Apps Script: Triggers → Add Trigger → <code className="text-slate-200">onEdit</code> → From spreadsheet → On edit</li>
          </ol>
        </div>
      </div>

      {/* Color legend */}
      <div className="glass rounded-[2rem] p-6 space-y-3">
        <h2 className="text-base font-semibold text-white">Cell Color Legend</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
          {[
            { color: '#b6d7a8', label: 'Confirmed (blocked)', status: 'confirmed' },
            { color: '#a4c2f4', label: 'Pending / Confirmed (unblocked)', status: 'pending' },
            { color: '#ffe599', label: 'Tentative', status: 'pending' },
            { color: '#ffffff', label: 'Empty / Cancelled', status: 'cancelled' },
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
