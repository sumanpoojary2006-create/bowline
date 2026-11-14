// Shift cutoffs (late check-in, half/full day) are defined in the
// property's own local clock, not the server's — Vercel runs functions in
// UTC, so reading a Date's own getHours() would be off by 5:30.
const PROPERTY_TIME_ZONE = process.env.BOWLINE_TIME_ZONE || 'Asia/Kolkata';

const hourMinuteFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PROPERTY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Time of day at the property, as decimal hours — e.g. 19:30 IST -> 19.5 —
// regardless of the server's own timezone.
export const istTimeOfDay = (date = new Date()) => {
  const parts = hourMinuteFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour + minute / 60;
};

const IST_OFFSET_MINUTES = 330; // UTC+5:30, no DST

// Builds the UTC instant for a given wall-clock time at the property, e.g.
// istWallTimeToDate('2026-03-05', 22) -> 2026-03-05T22:00 IST as a Date.
// `new Date('2026-03-05T22:00:00')` is ambiguous (parsed in the server's own
// timezone), which is wrong on a UTC server — this is always IST.
export const istWallTimeToDate = (dateKey, hour, minute = 0) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MINUTES * 60 * 1000);
};
