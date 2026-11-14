import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLaundry, calculateLaundryAvailability, initialLaundryStock } from './laundry.js';

const stock = initialLaundryStock.map((item) => ({ ...item, stock: item.stock ?? 10 }));
const entries = () => stock.map((item) => ({ id: item.id, sent: 0, received: 0 }));

test('calculates in-house stock from admin stock, sent, and received', () => {
  const input = entries();
  input[0] = { id: '1', sent: 7, received: 0 };
  const result = calculateLaundry(stock, input);
  assert.equal(result[0].summary, 7);
});

test('requires configured stock and complete unique integer counts', () => {
  assert.throws(() => calculateLaundry(initialLaundryStock, entries()), /Pillow/);
  const duplicate = entries();
  duplicate[1].id = '1';
  assert.throws(() => calculateLaundry(stock, duplicate), /exactly once/);
  const tooManySent = entries();
  tooManySent[0].sent = 15;
  assert.throws(() => calculateLaundry(stock, tooManySent), /Check laundry/);
});

test('stock must be submitted before it becomes receivable', () => {
  const input = entries();
  input[0] = { id: '1', sent: 8, received: 0 };
  assert.equal(calculateLaundry(stock, input)[0].summary, 6);
  input[0].received = 1;
  assert.throws(() => calculateLaundry(stock, input), /Previously Sent Stock/);
});

test('next day received stock is added to opening in-house stock', () => {
  const submissions = [{
    date: '2026-11-13',
    rows: stock.map((item) => ({ id: item.id, sent: item.id === '1' ? 8 : 0, received: 0 })),
  }];
  const availability = calculateLaundryAvailability(stock, submissions, '2026-11-14');
  assert.equal(availability[0].inHouse, 6);
  assert.equal(availability[0].previouslySent, 8);
  assert.equal(availability[0].availableToReceive, 8);
  const input = entries();
  input[0] = { id: '1', sent: 0, received: 6 };
  assert.equal(calculateLaundry(stock, input, availability)[0].summary, 12);
});

test('previously sent stock acts as the received barrier', () => {
  const submissions = [{ date: '2026-11-13', rows: [{ id: '1', sent: 4, received: 0 }] }];
  const availability = calculateLaundryAvailability(stock, submissions, '2026-11-14');
  const input = entries();
  input[0] = { id: '1', sent: 10, received: 4 };
  assert.equal(availability[0].previouslySent, 4);
  assert.equal(calculateLaundry(stock, input, availability)[0].summary, 4);
  input[0].received = 5;
  assert.throws(() => calculateLaundry(stock, input, availability), /Previously Sent Stock/);
});

test('today movements update previously sent and receivable limits', () => {
  const submissions = [
    { date: '2026-11-13', rows: [{ id: '1', sent: 6, received: 0 }] },
    { date: '2026-11-14', rows: [{ id: '1', sent: 2, received: 4 }] },
  ];
  const availability = calculateLaundryAvailability(stock, submissions, '2026-11-14');
  assert.equal(availability[0].previouslySent, 4);
  assert.equal(availability[0].availableToReceive, 4);
  assert.equal(availability[0].inHouse, 10);
  assert.equal(availability[0].atLaundry, 4);
});

test('submitted sent stock appears immediately and becomes receivable', () => {
  const submissions = [{ date: '2026-11-14', rows: [{ id: '1', sent: 10, received: 0 }] }];
  const availability = calculateLaundryAvailability(stock, submissions, '2026-11-14');
  assert.equal(availability[0].previouslySent, 10);
  assert.equal(availability[0].atLaundry, 10);
  assert.equal(availability[0].inHouse, 4);
  assert.equal(availability[0].availableToReceive, 10);
  const input = entries();
  input[0] = { id: '1', sent: 0, received: 10 };
  assert.equal(calculateLaundry(stock, input, availability)[0].summary, 14);
});
