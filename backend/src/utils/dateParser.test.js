import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateRange } from './dateParser.js';

test('date parser preserves calendar days as UTC-midnight values', () => {
  const range = parseDateRange('16 Oct 2026 - 17 Oct 2026');
  assert.equal(range.startDate.toISOString(), '2026-10-16T00:00:00.000Z');
  assert.equal(range.endDate.toISOString(), '2026-10-17T00:00:00.000Z');
});
