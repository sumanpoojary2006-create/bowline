import test from 'node:test';
import assert from 'node:assert/strict';
import { sortRoomsForDisplay } from './roomOrder.js';

test('rooms use the customer-facing Bowline order', () => {
  const rooms = [
    { slug: 'cozy-mini' },
    { slug: 'cozy-2' },
    { slug: 'pent-house' },
    { slug: 'cozy-1' },
  ];

  assert.deepEqual(
    sortRoomsForDisplay(rooms).map((room) => room.slug),
    ['pent-house', 'cozy-1', 'cozy-2', 'cozy-mini']
  );
});

test('unknown room types remain after the configured rooms', () => {
  const rooms = [{ slug: 'new-room' }, { slug: 'cozy-1' }, { slug: 'pent-house' }];

  assert.deepEqual(
    sortRoomsForDisplay(rooms).map((room) => room.slug),
    ['pent-house', 'cozy-1', 'new-room']
  );
});
