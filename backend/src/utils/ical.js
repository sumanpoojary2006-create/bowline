// Minimal iCal (RFC 5545) helpers — just enough to read Airbnb's exported
// busy-date feeds and to publish our own busy-date feed for Airbnb to import.
// Avoids a third-party dependency since both feeds only need flat VEVENTs
// with date (not date-time) DTSTART/DTEND/UID/SUMMARY.

const parseIcsDate = (value) => {
  // Strip any VALUE=DATE / TZID params already handled by caller — value is
  // either "YYYYMMDD" or "YYYYMMDDTHHMMSSZ".
  const datePart = value.slice(0, 8);
  const year = Number(datePart.slice(0, 4));
  const month = Number(datePart.slice(4, 6)) - 1;
  const day = Number(datePart.slice(6, 8));
  return new Date(Date.UTC(year, month, day));
};

// Unfold folded lines (lines starting with a space/tab continue the previous line)
// then split into logical lines.
const unfoldLines = (text) =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else if (line.trim()) {
        lines.push(line);
      }
      return lines;
    }, []);

export const parseIcsEvents = (text) => {
  const lines = unfoldLines(text);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.start && current?.end && current?.uid) {
        events.push(current);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;

    const rawKey = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    const key = rawKey.split(';')[0];

    if (key === 'DTSTART') current.start = parseIcsDate(value);
    else if (key === 'DTEND') current.end = parseIcsDate(value);
    else if (key === 'UID') current.uid = value;
    else if (key === 'SUMMARY') current.summary = value;
  }

  return events;
};

const toIcsDate = (date) => {
  const d = new Date(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

const toIcsTimestamp = (date) =>
  new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const escapeIcsText = (text = '') =>
  String(text).replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');

export const buildIcsCalendar = ({ name, events }) => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bowline Nature Stay//Booking Sync//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
  ];

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(event.uid)}`,
      `DTSTAMP:${toIcsTimestamp(new Date())}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.start)}`,
      `DTEND;VALUE=DATE:${toIcsDate(event.end)}`,
      `SUMMARY:${escapeIcsText(event.summary || 'Reserved')}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};
