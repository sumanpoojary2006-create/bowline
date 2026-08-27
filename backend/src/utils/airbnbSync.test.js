import test from 'node:test';
import assert from 'node:assert/strict';
import { isAirbnbReservationEvent } from './airbnbSync.js';

test('a real Airbnb reservation is eligible for Full House fan-out', () => {
  assert.equal(isAirbnbReservationEvent({ summary: 'Reserved' }), true);
});

test('an imported not-available event never becomes a Full House booking', () => {
  assert.equal(isAirbnbReservationEvent({ summary: 'Airbnb (Not available)' }), false);
});

test('an event without a reservation summary is not treated as a booking', () => {
  assert.equal(isAirbnbReservationEvent({}), false);
});
