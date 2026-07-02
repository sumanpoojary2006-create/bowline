import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

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

const parseSingleDate = (value) => {
  const trimmed = normalizeDateString(value.trim());

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(trimmed, format, true);

    if (parsed.isValid()) {
      let result = parsed.startOf('day');

      if (!format.includes('YYYY')) {
        result = result.year(dayjs().year());

        if (result.isBefore(dayjs(), 'day')) {
          result = result.add(1, 'year');
        }
      }

      return result;
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

  const startDate = parseSingleDate(parts[0]);
  const endDate = parseSingleDate(parts[1]);

  if (!startDate || !endDate) {
    return null;
  }

  return { startDate: startDate.toDate(), endDate: endDate.toDate() };
};
