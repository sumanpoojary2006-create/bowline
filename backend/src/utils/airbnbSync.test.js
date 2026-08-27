import test from 'node:test';
import assert from 'node:assert/strict';
import { getAirbnbExternalId, isAirbnbReservationEvent } from './airbnbSync.js';

test('a real Airbnb reservation is eligible for Full House fan-out', () => {
  assert.equal(isAirbnbReservationEvent({ summary: 'Reserved' }), true);
});

test('an imported not-available event never becomes a Full House booking', () => {
  assert.equal(isAirbnbReservationEvent({ summary: 'Airbnb (Not available)' }), false);
});

test('an event without a reservation summary is not treated as a booking', () => {
  assert.equal(isAirbnbReservationEvent({}), false);
});

test('Airbnb block identity stays stable when Airbnb changes its UID', () => {
  const range = { start: new Date('2026-10-02T00:00:00.000Z') };

  assert.equal(
    getAirbnbExternalId({ uid: 'first@airbnb.com' }, range, true),
    getAirbnbExternalId({ uid: 'replacement@airbnb.com' }, range, true)
  );
});

test('real reservations retain their Airbnb UID', () => {
  const range = { start: new Date('2026-10-02T00:00:00.000Z') };
  assert.equal(getAirbnbExternalId({ uid: 'reservation@airbnb.com' }, range, false), 'reservation@airbnb.com');
});
