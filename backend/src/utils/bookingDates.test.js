import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBookingDate,
  nightsBetweenBookingDates,
  parseDateKey,
  toPropertyDateKey,
  validateBookingDates,
} from './bookingDates.js';

const now = new Date('2026-10-16T04:00:00.000Z'); // 09:30 in the property's timezone

test('booking dates are formatted in the property timezone, not the host timezone', () => {
  const checkIn = new Date('2026-10-15T18:30:00.000Z');
  assert.equal(toPropertyDateKey(checkIn), '2026-10-16');
  assert.equal(formatBookingDate(checkIn), '16 Oct 2026');
});

test('same-day check-in is rejected and tomorrow is accepted', () => {
  assert.equal(
    validateBookingDates({
      startDate: parseDateKey('2026-10-16'),
      endDate: parseDateKey('2026-10-17'),
      now,
    }).message,
    'Check-in must be tomorrow or a later date.'
  );

  assert.equal(
    validateBookingDates({
      startDate: parseDateKey('2026-10-17'),
      endDate: parseDateKey('2026-10-18'),
      now,
    }).valid,
    true
  );
});

test('night count is based on calendar dates', () => {
  assert.equal(
    nightsBetweenBookingDates('2026-10-15T18:30:00.000Z', '2026-10-16T18:30:00.000Z'),
    1
  );
});
