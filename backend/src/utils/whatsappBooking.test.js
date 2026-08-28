import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WHATSAPP_QUERY_REPLY,
  allocateCouponDiscount,
  getRazorpayCustomerEmail,
  looksLikeCustomerQuery,
  excludeSelectedRooms,
} from './whatsappBooking.js';

test('coupon discount is distributed across every room without changing the total discount', () => {
  const discounts = allocateCouponDiscount([{ totalPrice: 3000 }, { totalPrice: 2000 }], 750);
  assert.deepEqual(discounts, [450, 300]);
  assert.equal(discounts.reduce((sum, value) => sum + value, 0), 750);
});

test('coupon discount never exceeds the booking subtotal', () => {
  assert.deepEqual(allocateCouponDiscount([{ totalPrice: 500 }, { totalPrice: 500 }], 2000), [500, 500]);
});

test('Razorpay customer email is normalized and validated', () => {
  assert.equal(getRazorpayCustomerEmail({ email: ' Guest@Example.COM ' }), 'guest@example.com');
  assert.equal(getRazorpayCustomerEmail({ email: 'not-an-email' }), '');
});

test('query reply contains the official Bowline WhatsApp link', () => {
  assert.match(WHATSAPP_QUERY_REPLY, /https:\/\/wa\.me\/message\/YASL6E2YGMZ6B1/);
});

test('questions are distinguished from expected booking values', () => {
  assert.equal(looksLikeCustomerQuery('What food is available?'), true);
  assert.equal(looksLikeCustomerQuery('Can I bring a pet'), true);
  assert.equal(looksLikeCustomerQuery('2 Sep to 4 Sep'), false);
  assert.equal(looksLikeCustomerQuery('SUMMER20'), false);
});

test('rooms already added to the WhatsApp cart are excluded from the next room list', () => {
  const rooms = [
    { _id: 'pent-house', name: 'Pent House' },
    { _id: 'cozy-1', name: 'Cozy 1' },
    { _id: 'cozy-2', name: 'Cozy 2' },
    { _id: 'cozy-mini', name: 'Cozy Mini' },
  ];

  assert.deepEqual(
    excludeSelectedRooms(rooms, [
      { listingId: 'pent-house' },
      { listingId: 'cozy-2' },
    ]).map((room) => room.name),
    ['Cozy 1', 'Cozy Mini']
  );
});
