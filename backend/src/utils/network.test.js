import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedIp, isValidIpRule } from './network.js';

test('allows exact IPv4 and IPv6 addresses', () => {
  assert.equal(isAllowedIp('157.50.181.23', ['157.50.181.23']), true);
  assert.equal(isAllowedIp('2409:40f2:209f:8d80::1', ['2409:40f2:209f:8d80::1']), true);
  assert.equal(isAllowedIp('157.50.181.24', ['157.50.181.23']), false);
});

test('allows devices within the configured property network range', () => {
  const rules = ['2409:40f2:209f:8d80::/64'];
  assert.equal(isAllowedIp('2409:40f2:209f:8d80:34f4:5766:4f4d:1d58', rules), true);
  assert.equal(isAllowedIp('2409:40f2:209f:8d81::1', rules), false);
});

test('validates IP address and CIDR rules', () => {
  assert.equal(isValidIpRule('10.0.0.0/24'), true);
  assert.equal(isValidIpRule('2409:40f2:209f:8d80::/64'), true);
  assert.equal(isValidIpRule('10.0.0.0/40'), false);
  assert.equal(isValidIpRule('Bowline naturestay'), false);
});
