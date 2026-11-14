import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import {
  parseDateKey,
  todayPropertyDateKey,
} from './bookingDates.js';

dayjs.extend(customParseFormat);

const DATE_FORMATS = [
  'D MMM YYYY',
  'D MMM',
  'D/M/YYYY',
  'DD/MM/YYYY',
  'D-M-YYYY',
  'DD-MM-YYYY',
  'YYYY-MM-DD',
];

const normalizeDateString = (value) => {
  // Capitalize first letter of month abbreviation so "12 jul" -> "12 Jul"
  return value.replace(/([a-zA-Z]+)/g, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
};

const parseSingleDate = (value, todayKey = todayPropertyDateKey()) => {
  const trimmed = normalizeDateString(value.trim());

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(trimmed, format, true);

    if (parsed.isValid()) {
      let year = parsed.year();
      if (!format.includes('YYYY')) {
        year = Number(todayKey.slice(0, 4));
      }

      let key = `${year}-${String(parsed.month() + 1).padStart(2, '0')}-${String(parsed.date()).padStart(2, '0')}`;
      // A month/day without a year means the next occurrence of that date.
      // This keeps the WhatsApp flow aligned with the website's future-date
      // policy even when the message arrives near midnight or year-end.
      if (!format.includes('YYYY') && key < todayKey) {
        key = `${year + 1}-${key.slice(5)}`;
      }

      return parseDateKey(key);
    }
  }

  return null;
};

export const parseDateRange = (text) => {
  const parts = text
    .split(/-|to/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const todayKey = todayPropertyDateKey();
  const startDate = parseSingleDate(parts[0], todayKey);
  const endDate = parseSingleDate(parts[1], todayKey);

  if (!startDate || !endDate) {
    return null;
  }

  return { startDate, endDate };
};
