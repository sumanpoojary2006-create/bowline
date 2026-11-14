import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLaundryDamageReport, getPreviousMonthWindow } from './laundryDamageReport.js';

test('previous month window follows the property timezone', () => {
  const result = getPreviousMonthWindow(new Date('2026-11-30T20:30:00.000Z'));
  assert.equal(result.key, '2026-11');
  assert.equal(result.start.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(result.end.toISOString(), '2026-11-30T18:30:00.000Z');
});

test('monthly laundry report separates lost and damaged quantities', () => {
  const report = buildLaundryDamageReport([
    { itemName: 'Bedsheet <White>', reason: 'lost', quantity: 2, previousStock: 14, newStock: 12, adminName: 'Admin' },
    { itemName: 'Bath Towel', reason: 'damaged', quantity: 3, previousStock: 43, newStock: 40, adminName: 'Admin' },
  ], 'October 2026');
  assert.deepEqual(report.totals, { lost: 2, damaged: 3, total: 5 });
  assert.match(report.emailBody, /Lost: 2/);
  assert.match(report.emailHtml, /Bedsheet &lt;White&gt;/);
});
