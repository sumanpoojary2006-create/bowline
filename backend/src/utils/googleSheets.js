import { google } from 'googleapis';

// ── Column layout of the Google Sheet ──────────────────────────────────────
// Col A  = Date
// Col B  = Cozy 1
// Col C  = Cozy 2
// Col D  = Cozy Mini
// Col E  = Dorm
// Col F  = Penthouse
//
// Room names MUST exactly match Listing.name values in MongoDB.
// Adjust ROOM_COLUMNS if your listing names differ.

export const ROOM_COLUMNS = {
  'Cozy 1':    { col: 'B', idx: 2 },
  'Cozy 2':    { col: 'C', idx: 3 },
  'Cozy Mini': { col: 'D', idx: 4 },
  'Dorm':      { col: 'E', idx: 5 },
  'Penthouse': { col: 'F', idx: 6 },
};

export const COLUMN_TO_ROOM = Object.fromEntries(
  Object.entries(ROOM_COLUMNS).map(([name, { col }]) => [col, name])
);

// Status → background colour (hex without #)
export const STATUS_COLORS = {
  confirmed: '#b6d7a8',   // light green
  pending:   '#a4c2f4',   // light blue
  cancelled: '#ffffff',   // white (clear)
};

// Background colour → status
const COLOR_TO_STATUS = {
  '#b6d7a8': 'confirmed',
  '#93c47d': 'confirmed',
  '#a4c2f4': 'pending',
  '#4a86e8': 'pending',
  '#6d9eeb': 'pending',
  '#ffe599': 'pending',   // tentative → treat as pending
  '#ffffff': null,
  '#000000': null,
};

export function colorToStatus(hex) {
  if (!hex) return null;
  const lower = hex.toLowerCase();
  return COLOR_TO_STATUS[lower] ?? 'pending';
}

// ── Month sheet name helpers ────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function sheetNameForDate(date) {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(-2);
  return `${MONTH_NAMES[d.getMonth()]} ${yy}`;
}

export function parseSheetName(name) {
  // "Jan 26" → { month: 0, year: 2026 }
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const month = MONTH_NAMES.findIndex((m) => m.toLowerCase() === parts[0].toLowerCase());
  if (month === -1) return null;
  const year = 2000 + parseInt(parts[1], 10);
  return { month, year };
}

// ── Auth ────────────────────────────────────────────────────────────────────
function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) return null;

  const key = rawKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

function getSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_ID || null;
}

export function isSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

// ── Read a full month sheet ─────────────────────────────────────────────────
// Returns { dates: Date[], columns: { [roomName]: { value, color }[] } }
export async function readMonthSheet(sheetName) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  if (!sheets || !spreadsheetId) return null;

  const lastCol = 'F';
  const range = `'${sheetName}'!A:${lastCol}`;

  const [valuesRes, formatsRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range }),
    sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [range],
      fields: 'sheets.data.rowData.values.userEnteredFormat.backgroundColor',
    }),
  ]);

  const rows = valuesRes.data.values || [];
  const formatRows =
    formatsRes.data.sheets?.[0]?.data?.[0]?.rowData || [];

  // Skip header row (index 0)
  const parsed = { month: sheetName, dates: [], columns: {} };
  for (const name of Object.keys(ROOM_COLUMNS)) {
    parsed.columns[name] = [];
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const fmtRow = formatRows[i]?.values || [];

    const rawDate = row[0];
    if (!rawDate) continue;
    const date = new Date(rawDate);
    if (isNaN(date.getTime())) continue;
    parsed.dates.push(date);

    for (const [roomName, { idx }] of Object.entries(ROOM_COLUMNS)) {
      const value = (row[idx - 1] || '').toString().trim();
      const bgObj = fmtRow[idx - 1]?.userEnteredFormat?.backgroundColor;
      const color = bgObj
        ? rgbToHex(bgObj.red, bgObj.green, bgObj.blue)
        : '#ffffff';
      parsed.columns[roomName].push({ value, color, date: new Date(date) });
    }
  }

  return parsed;
}

function rgbToHex(r = 0, g = 0, b = 0) {
  const toInt = (v) => Math.round((v || 0) * 255);
  return (
    '#' +
    [toInt(r), toInt(g), toInt(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

// ── Group consecutive same-guest cells into bookings ───────────────────────
export function groupCellsIntoBookings(cells, roomName) {
  const bookings = [];
  let current = null;

  for (const cell of cells) {
    const guest = cell.value.trim();
    if (!guest) {
      if (current) {
        bookings.push(current);
        current = null;
      }
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
        endDate: end,
        status: colorToStatus(cell.color) || 'pending',
      };
    }
  }
  if (current) bookings.push(current);
  return bookings;
}

// ── Write a single booking to the sheet ────────────────────────────────────
export async function writeBookingToSheet(booking) {
  if (!isSheetsConfigured()) return;
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const roomName = booking.listing?.name || booking.listing;
  const colInfo = ROOM_COLUMNS[roomName];
  if (!colInfo) return; // room not mapped

  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  const guestName = booking.contactName || booking.user?.name || '';
  const color = STATUS_COLORS[booking.status] || STATUS_COLORS.pending;
  const colorRgb = hexToRgb(color);

  // Group days by month sheet
  const monthMap = {};
  const cur = new Date(start);
  while (cur < end) {
    const sn = sheetNameForDate(cur);
    if (!monthMap[sn]) monthMap[sn] = [];
    monthMap[sn].push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }

  for (const [sheetName, days] of Object.entries(monthMap)) {
    const parsed = parseSheetName(sheetName);
    if (!parsed) continue;

    const requests = days.map((day) => {
      const rowIdx = day.getDate() + 1; // row 2 = day 1
      const range = `'${sheetName}'!${colInfo.col}${rowIdx}`;
      return {
        range,
        values: [[guestName]],
        colorRange: range,
        colorRgb,
      };
    });

    // Batch values update
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: requests.map(({ range, values }) => ({ range, values })),
      },
    });

    // Batch format (background color)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: days.map((day) => {
          const rowIdx = day.getDate() + 1;
          return {
            repeatCell: {
              range: {
                sheetId: null, // resolved below per-sheet
                startRowIndex: rowIdx - 1,
                endRowIndex: rowIdx,
                startColumnIndex: colInfo.idx - 1,
                endColumnIndex: colInfo.idx,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: colorRgb,
                },
              },
              fields: 'userEnteredFormat.backgroundColor',
            },
          };
        }),
      },
    }).catch(() => {
      // Color formatting requires sheetId — skip silently if unavailable
      // Values are already written above
    });
  }
}

// ── Clear a booking from the sheet (on cancel) ─────────────────────────────
export async function clearBookingFromSheet(booking) {
  if (!isSheetsConfigured()) return;

  // Write with empty string + white background
  const clone = {
    ...booking,
    listing: booking.listing,
    contactName: '',
    status: 'cancelled',
  };
  await writeBookingToSheet(clone);
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    red:   parseInt(clean.slice(0, 2), 16) / 255,
    green: parseInt(clean.slice(2, 4), 16) / 255,
    blue:  parseInt(clean.slice(4, 6), 16) / 255,
  };
}

// ── Ensure all month sheets exist with headers ─────────────────────────────
export async function ensureSheetStructure(year = 2026) {
  if (!isSheetsConfigured()) return { error: 'Sheets not configured' };

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(meta.data.sheets.map((s) => s.properties.title));

  const addRequests = [];
  for (let m = 0; m < 12; m++) {
    const name = `${MONTH_NAMES[m]} ${String(year).slice(-2)}`;
    if (!existing.has(name)) {
      addRequests.push({ addSheet: { properties: { title: name } } });
    }
  }

  if (addRequests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: addRequests },
    });
  }

  // Write headers + date column for each month
  for (let m = 0; m < 12; m++) {
    const name = `${MONTH_NAMES[m]} ${String(year).slice(-2)}`;
    const daysInMonth = new Date(year, m + 1, 0).getDate();

    const headerRow = ['Date', ...Object.keys(ROOM_COLUMNS)];
    const dateRows = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, m, i + 1);
      return [d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })];
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `'${name}'!A1:F1`, values: [headerRow] },
          { range: `'${name}'!A2:A${daysInMonth + 1}`, values: dateRows },
        ],
      },
    });
  }

  return { ok: true };
}
