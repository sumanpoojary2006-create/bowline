import test from 'node:test';
import assert from 'node:assert/strict';
import { createOriginChecker } from './cors.js';

test('allows Bowline production, preview, and local origins', () => {
  const isAllowedOrigin = createOriginChecker('https://bowline-omega.vercel.app');

  assert.equal(isAllowedOrigin('https://www.bowlinestays.com'), true);
  assert.equal(isAllowedOrigin('https://bowlinestays.com'), true);
  assert.equal(isAllowedOrigin('https://bowline-omega.vercel.app'), true);
  assert.equal(isAllowedOrigin('https://bowline-payment-fix.vercel.app'), true);
  assert.equal(isAllowedOrigin('http://localhost:5173'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173'), true);
  assert.equal(isAllowedOrigin(undefined), true);
});

test('normalizes configured origins and rejects unrelated sites', () => {
  const isAllowedOrigin = createOriginChecker(
    'https://staff.bowlinestays.com/, https://admin.bowlinestays.com'
  );

  assert.equal(isAllowedOrigin('https://staff.bowlinestays.com'), true);
  assert.equal(isAllowedOrigin('https://admin.bowlinestays.com'), true);
  assert.equal(isAllowedOrigin('https://example.com'), false);
  assert.equal(isAllowedOrigin('not-a-url'), false);
});

