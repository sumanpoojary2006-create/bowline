import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WHATSAPP_QUERY_REPLY,
  allocateCouponDiscount,
  getRazorpayCustomerEmail,
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
