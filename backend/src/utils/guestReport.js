import dayjs from 'dayjs';
import Booking from '../models/Booking.js';

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
    vegCount: booking.vegCount,
    nonVegCount: booking.nonVegCount,
    checkIn: booking.startDate,
    checkOut: booking.endDate,
    specialRequests: booking.specialRequests,
  }));

  entries.sort((a, b) => a.room.localeCompare(b.room));

  const totals = entries.reduce(
    (acc, entry) => {
      acc.adults += entry.adultGuests || 0;
      acc.children += entry.childGuests || 0;
      acc.pets += entry.pets || 0;
      acc.veg += entry.vegCount || 0;
      acc.nonVeg += entry.nonVegCount || 0;
      return acc;
    },
    { adults: 0, children: 0, pets: 0, veg: 0, nonVeg: 0 }
  );

  return {
    date: date.format('YYYY-MM-DD'),
    dateLabel: date.format('D MMMM YYYY'),
    entries,
    totals,
  };
};
