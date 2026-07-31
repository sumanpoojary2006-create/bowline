import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCellsIntoBookings } from './googleSheets.js';

test('red sheet cells become one blocked booking range', () => {
  const bookings = groupCellsIntoBookings(
    [
      { date: '2026-08-07', value: "Anagha's Program", color: '#e06666' },
      { date: '2026-08-08', value: "Anagha's Program", color: '#e06666' },
    ],
    'Pent House'
  );

  assert.equal(bookings.length, 1);
  assert.equal(bookings[0].status, 'blocked');
  assert.equal(bookings[0].startDate.toISOString().slice(0, 10), '2026-08-07');
  assert.equal(bookings[0].endDate.toISOString().slice(0, 10), '2026-08-09');
});

test('same label with different colors does not merge statuses', () => {
  const bookings = groupCellsIntoBookings(
    [
      { date: '2026-08-07', value: 'Reserved', color: '#e06666' },
      { date: '2026-08-08', value: 'Reserved', color: '#b6d7a8' },
    ],
    'Pent House'
  );

  assert.deepEqual(
    bookings.map(({ status }) => status),
    ['blocked', 'confirmed']
  );
});

test('deposit-colored sheet cells remain unavailable', () => {
  const [booking] = groupCellsIntoBookings(
    [{ date: '2026-08-07', value: 'Guest', color: '#ffe599' }],
    'Pent House'
  );

  assert.equal(booking.status, 'confirmed');
});
