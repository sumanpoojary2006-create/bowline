import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_PAYMENT_STATUSES,
  buildUpcomingCheckinReportFromBookings,
  getUpcomingCheckinDateKeys,
} from './guestReport.js';

const runAtTwoAmIst = new Date('2026-11-14T20:30:00.000Z');

test('upcoming check-in window is calculated in the property timezone', () => {
  assert.deepEqual(getUpcomingCheckinDateKeys(runAtTwoAmIst), {
    todayKey: '2026-11-15',
    tomorrowKey: '2026-11-16',
    dayAfterKey: '2026-11-17',
    rangeEndKey: '2026-11-18',
  });
});

test('report eligibility is limited to 50% and fully paid statuses', () => {
  assert.deepEqual(REPORT_PAYMENT_STATUSES, ['partially_paid', 'paid']);
});

test('upcoming report contains the requested columns and summary totals', async () => {
  const bookings = [
    {
      _id: { toString: () => 'booking-2' },
      listing: { name: 'Cozy 1' },
      contactName: 'Guest Two',
      contactPhone: '9000000002',
      contactEmail: 'two@example.com',
      startDate: new Date('2026-11-17T00:00:00.000Z'),
      endDate: new Date('2026-11-18T00:00:00.000Z'),
      adultGuests: 2,
      childGuests: 1,
      guests: 3,
      pets: 0,
      paymentStatus: 'paid',
    },
    {
      _id: { toString: () => 'booking-1' },
      listing: { name: 'Pent House' },
      contactName: 'Guest One',
      contactPhone: '9000000001',
      contactEmail: 'one@example.com',
      startDate: new Date('2026-11-16T00:00:00.000Z'),
      endDate: new Date('2026-11-18T00:00:00.000Z'),
      adultGuests: 2,
      childGuests: 0,
      guests: 2,
      pets: 1,
      paymentStatus: 'partially_paid',
    },
  ];

  const occupancyBookings = [
    ...bookings,
    {
      _id: { toString: () => 'booking-current' },
      listing: { name: 'Cozy 2' },
      startDate: new Date('2026-11-15T00:00:00.000Z'),
      endDate: new Date('2026-11-18T00:00:00.000Z'),
      adultGuests: 3,
      childGuests: 1,
      guests: 4,
      pets: 0,
      paymentStatus: 'paid',
    },
  ];
  const report = buildUpcomingCheckinReportFromBookings(bookings, {
    now: runAtTwoAmIst,
    occupancyBookings,
  });

  assert.equal(report.entries[0].room, 'Pent House');
  assert.equal(report.entries[0].contactEmail, 'one@example.com');
  assert.equal(report.entries[0].guestCount, 2);
  assert.equal(report.entries[1].room, 'Cozy 1');
  assert.equal(report.dateSections.length, 2);
  assert.equal(report.dateSections[0].dateLabel, '16 Nov 2026');
  assert.deepEqual(report.dateSections[0].entries.map((entry) => entry.room), ['Pent House']);
  assert.deepEqual(report.dateSections[0].totals, {
    bookings: 1,
    guests: 2,
    adults: 2,
    children: 0,
    pets: 1,
  });
  assert.equal(report.dateSections[1].dateLabel, '17 Nov 2026');
  assert.deepEqual(report.dateSections[1].entries.map((entry) => entry.room), ['Cozy 1']);
  assert.deepEqual(report.dateSections[1].totals, {
    bookings: 1,
    guests: 3,
    adults: 2,
    children: 1,
    pets: 0,
  });
  assert.deepEqual(report.occupancySections, [
    {
      dateKey: '2026-11-16',
      dateLabel: '16 Nov 2026',
      currentGuests: 4,
      newCheckInGuests: 2,
      totalGuests: 6,
      occupiedRooms: 2,
    },
    {
      dateKey: '2026-11-17',
      dateLabel: '17 Nov 2026',
      currentGuests: 6,
      newCheckInGuests: 3,
      totalGuests: 9,
      occupiedRooms: 3,
    },
  ]);
  assert.deepEqual(report.totals, {
    bookings: 2,
    guests: 5,
    adults: 4,
    children: 1,
    pets: 1,
  });

});
