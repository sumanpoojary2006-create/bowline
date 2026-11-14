import dayjs from 'dayjs';
import Booking from '../models/Booking.js';
import { getAmountPaid, getAmountDue } from '../controllers/paymentController.js';
import {
  formatBookingDate,
  parseDateKey,
  todayPropertyDateKey,
  toPropertyDateKey,
} from './bookingDates.js';

const DAY_MS = 86400000;
export const REPORT_PAYMENT_STATUSES = ['partially_paid', 'paid'];

const addDaysToDateKey = (dateKey, days) => {
  const date = parseDateKey(dateKey);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
};

export const getUpcomingCheckinDateKeys = (now = new Date()) => {
  const todayKey = todayPropertyDateKey(now);
  return {
    todayKey,
    tomorrowKey: addDaysToDateKey(todayKey, 1),
    dayAfterKey: addDaysToDateKey(todayKey, 2),
    rangeEndKey: addDaysToDateKey(todayKey, 3),
  };
};

const normalizeGuestCounts = (booking) => {
  const adults = Number(booking.adultGuests || 0);
  const children = Number(booking.childGuests || 0);
  const guests = adults + children || Number(booking.guests || 0);
  return { adults, children, guests };
};

const summarizeEntries = (entries) =>
  entries.reduce(
    (summary, entry) => {
      summary.bookings += 1;
      summary.guests += entry.guestCount;
      summary.adults += entry.adultGuests;
      summary.children += entry.childGuests;
      summary.pets += entry.pets;
      return summary;
    },
    { bookings: 0, guests: 0, adults: 0, children: 0, pets: 0 }
  );

export const getGuestsForDate = async (dateInput) => {
  const dayStart = dayjs(dateInput).startOf('day').toDate();
  const dayEnd = dayjs(dateInput).endOf('day').toDate();

  const bookings = await Booking.find({
    bookingType: 'room',
    status: 'confirmed',
    startDate: { $lte: dayEnd },
    endDate: { $gt: dayStart },
  })
    .populate('listing')
    .sort({ 'listing.name': 1, startDate: 1 });

  return bookings;
};

export const buildDailyReport = async (dateInput) => {
  const date = dayjs(dateInput).startOf('day');
  const bookings = await getGuestsForDate(date);

  const entries = bookings.map((booking) => ({
    bookingId: booking._id.toString(),
    room: booking.listing?.name || 'N/A',
    contactName: booking.contactName,
    contactPhone: booking.contactPhone,
    adultGuests: booking.adultGuests,
    childGuests: booking.childGuests,
    pets: booking.pets,
    checkIn: booking.startDate,
    checkOut: booking.endDate,
    specialRequests: booking.specialRequests,
    totalPrice: booking.totalPrice,
    paymentStatus: booking.paymentStatus,
    amountPaid: getAmountPaid(booking),
    amountDue: getAmountDue(booking),
  }));

  entries.sort((a, b) => a.room.localeCompare(b.room));

  const totals = entries.reduce(
    (acc, entry) => {
      acc.adults += entry.adultGuests || 0;
      acc.children += entry.childGuests || 0;
      acc.pets += entry.pets || 0;
      return acc;
    },
    { adults: 0, children: 0, pets: 0 }
  );

  return {
    date: date.format('YYYY-MM-DD'),
    dateLabel: date.format('D MMMM YYYY'),
    entries,
    totals,
  };
};

export const getUpcomingCheckins = async (now = new Date()) => {
  const { tomorrowKey, dayAfterKey, rangeEndKey } = getUpcomingCheckinDateKeys(now);

  const bookings = await Booking.find({
    bookingType: 'room',
    status: 'confirmed',
    paymentStatus: { $in: REPORT_PAYMENT_STATUSES },
    startDate: {
      $gte: parseDateKey(tomorrowKey),
      $lt: parseDateKey(rangeEndKey),
    },
  })
    .populate('listing')
    .sort({ startDate: 1, 'listing.name': 1 });

  return { bookings, tomorrowKey, dayAfterKey };
};

export const getUpcomingOccupancyBookings = async (now = new Date()) => {
  const { tomorrowKey, rangeEndKey } = getUpcomingCheckinDateKeys(now);

  return Booking.find({
    bookingType: 'room',
    status: 'confirmed',
    paymentStatus: { $in: REPORT_PAYMENT_STATUSES },
    startDate: { $lt: parseDateKey(rangeEndKey) },
    endDate: { $gt: parseDateKey(tomorrowKey) },
  })
    .populate('listing')
    .sort({ startDate: 1, 'listing.name': 1 });
};

export const buildUpcomingCheckinReportFromBookings = (
  bookings,
  { now = new Date(), tomorrowKey, dayAfterKey, occupancyBookings = bookings } = {}
) => {
  const keys = getUpcomingCheckinDateKeys(now);
  const resolvedTomorrowKey = tomorrowKey || keys.tomorrowKey;
  const resolvedDayAfterKey = dayAfterKey || keys.dayAfterKey;
  const entries = bookings.map((booking) => {
    const counts = normalizeGuestCounts(booking);
    return {
      bookingId: booking._id.toString(),
      room: booking.listing?.name || 'N/A',
      contactName: booking.contactName || 'N/A',
      contactPhone: booking.contactPhone || '',
      contactEmail: booking.contactEmail || booking.user?.email || '',
      checkIn: booking.startDate,
      checkOut: booking.endDate,
      checkInKey: toPropertyDateKey(booking.startDate),
      checkOutKey: toPropertyDateKey(booking.endDate),
      checkInLabel: formatBookingDate(booking.startDate),
      checkOutLabel: formatBookingDate(booking.endDate),
      adultGuests: counts.adults,
      childGuests: counts.children,
      guestCount: counts.guests,
      pets: Number(booking.pets || 0),
      paymentStatus: booking.paymentStatus,
    };
  });

  entries.sort((a, b) => {
    const dateOrder = a.checkInKey.localeCompare(b.checkInKey);
    return dateOrder || a.room.localeCompare(b.room);
  });

  const dateKeys = [resolvedTomorrowKey, resolvedDayAfterKey];
  const dateLabels = dateKeys.map((dateKey) => formatBookingDate(parseDateKey(dateKey)));
  const dateSections = dateKeys.map((dateKey, index) => {
    const sectionEntries = entries.filter((entry) => entry.checkInKey === dateKey);
    return {
      dateKey,
      dateLabel: dateLabels[index],
      entries: sectionEntries,
      totals: summarizeEntries(sectionEntries),
    };
  });
  const occupancyEntries = occupancyBookings.map((booking) => {
    const counts = normalizeGuestCounts(booking);
    return {
      bookingId: booking._id.toString(),
      room: booking.listing?.name || 'N/A',
      checkInKey: toPropertyDateKey(booking.startDate),
      checkOutKey: toPropertyDateKey(booking.endDate),
      adultGuests: counts.adults,
      childGuests: counts.children,
      guestCount: counts.guests,
      pets: Number(booking.pets || 0),
    };
  });
  const occupancySections = dateKeys.map((dateKey, index) => {
    const stayingEntries = occupancyEntries.filter(
      (entry) => entry.checkInKey <= dateKey && entry.checkOutKey > dateKey
    );
    const newCheckInEntries = stayingEntries.filter((entry) => entry.checkInKey === dateKey);
    const currentGuestEntries = stayingEntries.filter((entry) => entry.checkInKey < dateKey);

    return {
      dateKey,
      dateLabel: dateLabels[index],
      currentGuests: summarizeEntries(currentGuestEntries).guests,
      newCheckInGuests: summarizeEntries(newCheckInEntries).guests,
      totalGuests: summarizeEntries(stayingEntries).guests,
      occupiedRooms: stayingEntries.length,
    };
  });
  const totals = summarizeEntries(entries);

  return {
    reportKey: `${todayPropertyDateKey(now)}-upcoming-checkins`,
    generatedForDate: todayPropertyDateKey(now),
    tomorrowKey: resolvedTomorrowKey,
    dayAfterKey: resolvedDayAfterKey,
    dateKeys,
    dateLabels,
    dateSections,
    occupancySections,
    entries,
    totals,
  };
};

export const buildUpcomingCheckinReport = async (now = new Date()) => {
  const [{ bookings, tomorrowKey, dayAfterKey }, occupancyBookings] = await Promise.all([
    getUpcomingCheckins(now),
    getUpcomingOccupancyBookings(now),
  ]);
  return buildUpcomingCheckinReportFromBookings(bookings, {
    now,
    tomorrowKey,
    dayAfterKey,
    occupancyBookings,
  });
};
