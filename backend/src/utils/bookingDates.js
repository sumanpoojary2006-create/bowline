// Booking dates represent calendar days at the property, not moments in time.
// Keep the property timezone explicit so a deployment's host timezone cannot
// move a check-in backwards when it is rendered in an email or WhatsApp.
export const PROPERTY_TIME_ZONE = process.env.BOWLINE_TIME_ZONE || 'Asia/Kolkata';

const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PROPERTY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const displayFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: PROPERTY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const shortDisplayFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: PROPERTY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
});

const dateKeyFromParts = (parts) => {
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const toPropertyDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateKeyFromParts(datePartsFormatter.formatToParts(date));
};

export const parseDateKey = (value) => {
  const key = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;

  const date = new Date(`${key}T00:00:00.000Z`);
  // Reject impossible calendar dates such as 2026-02-31.
  return toPropertyDateKey(date) === key ? date : null;
};

export const todayPropertyDateKey = (now = new Date()) => toPropertyDateKey(now);

export const isFutureCheckInDate = (value, now = new Date()) => {
  const key = toPropertyDateKey(value);
  return Boolean(key && key > todayPropertyDateKey(now));
};

export const formatBookingDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return displayFormatter.format(date);
};

export const formatShortBookingDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return shortDisplayFormatter.format(date);
};

export const nightsBetweenBookingDates = (startDate, endDate) => {
  const startKey = toPropertyDateKey(startDate);
  const endKey = toPropertyDateKey(endDate);
  if (!startKey || !endKey) return 0;
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  return Math.max(Math.round((end - start) / 86400000), 0);
};

export const validateBookingDates = ({ startDate, endDate, requireFuture = true, now = new Date() }) => {
  const startKey = toPropertyDateKey(startDate);
  const endKey = toPropertyDateKey(endDate);

  if (!startKey || !endKey) {
    return { valid: false, message: 'Please provide valid check-in and check-out dates.' };
  }

  if (endKey <= startKey) {
    return { valid: false, message: 'Check-out date must be after the check-in date.' };
  }

  if (requireFuture && startKey <= todayPropertyDateKey(now)) {
    return { valid: false, message: 'Check-in must be tomorrow or a later date.' };
  }

  return { valid: true, startKey, endKey };
};
