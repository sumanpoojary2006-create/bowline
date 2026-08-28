import test from 'node:test';
import assert from 'node:assert/strict';
import { isBookedDay, wouldCheckoutConflict } from './waDateAvailability.js';

const localDate = (year, month, day) => new Date(year, month - 1, day);
const bookedRanges = [
  {
    startDate: '2026-10-02T00:00:00.000Z',
    endDate: '2026-10-04T00:00:00.000Z',
    status: 'confirmed',
  },
];

test('booked nights are blocked but checkout day is available', () => {
  assert.equal(isBookedDay(localDate(2026, 10, 2), bookedRanges), true);
  assert.equal(isBookedDay(localDate(2026, 10, 3), bookedRanges), true);
  assert.equal(isBookedDay(localDate(2026, 10, 4), bookedRanges), false);
});

test('checkout may land on the next booking check-in day', () => {
  const checkIn = localDate(2026, 10, 1);
  assert.equal(wouldCheckoutConflict(localDate(2026, 10, 2), checkIn, bookedRanges), false);
});

test('checkout cannot cross or include a booked night', () => {
  const checkIn = localDate(2026, 10, 1);
  assert.equal(wouldCheckoutConflict(localDate(2026, 10, 3), checkIn, bookedRanges), true);
  assert.equal(wouldCheckoutConflict(localDate(2026, 10, 5), checkIn, bookedRanges), true);
});

test('admin blocks are treated as unavailable', () => {
  const blocked = [{ ...bookedRanges[0], status: 'blocked' }];
  assert.equal(isBookedDay(localDate(2026, 10, 2), blocked), true);
});
