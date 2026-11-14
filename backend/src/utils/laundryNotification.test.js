import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLaundryAdminNotification } from './laundryNotification.js';

test('builds an item-wise admin email with laundry totals', () => {
  const result = buildLaundryAdminNotification({
    staffName: 'Asha <Staff>',
    date: '2026-11-14',
    createdAt: new Date('2026-11-14T06:30:00.000Z'),
    rows: [
      { name: 'Bedsheet Double', sent: 7, received: 2, summary: 9 },
      { name: 'Pillow Cover', sent: 3, received: 1, summary: 18 },
    ],
  });

  assert.deepEqual(result.totals, { sent: 10, received: 3, inHouse: 27 });
  assert.match(result.emailSubject, /Asha <Staff>/);
  assert.match(result.emailBody, /Summary \| Sent: 10 \| Received: 3 \| In-house: 27/);
  assert.match(result.emailHtml, /Asha &lt;Staff&gt;/);
  assert.doesNotMatch(result.emailHtml, /Asha <Staff>/);
  assert.match(result.emailHtml, /Bedsheet Double/);
});
