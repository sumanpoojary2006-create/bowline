import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHECK_IN_TIME,
  CHECK_OUT_TIME,
  DINNER_PRICE,
  GUEST_ARRIVAL_INFORMATION,
  LUNCH_PRICE,
  MEAL_SUMMARY,
} from './guestStayInfo.js';

test('guest information uses the current timings and meal prices', () => {
  assert.equal(CHECK_IN_TIME, '2:00 PM');
  assert.equal(CHECK_OUT_TIME, '11:00 AM');
  assert.equal(LUNCH_PRICE, 300);
  assert.equal(DINNER_PRICE, 400);

  for (const expected of [
    'Check-in: 2:00 PM',
    'Check-out: 11:00 AM',
    'Lunch: ₹300 per person (not available on day 1)',
    'Dinner: ₹400 per person',
    'https://share.google/dWeVnCH4nwJeWfTCm',
    'https://share.google/SM746qsa5vor3gPnU',
  ]) {
    assert.match(GUEST_ARRIVAL_INFORMATION, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(MEAL_SUMMARY, /Lunch is Rs 300/);
  assert.match(MEAL_SUMMARY, /Dinner is Rs 400/);
});
