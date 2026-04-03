import Booking from '../models/Booking.js';

export const getExistingBookingsForRange = async ({ listingId, startDate, endDate }) =>
  Booking.find({
    listing: listingId,
    status: { $in: ['pending', 'confirmed'] },
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) },
  });

export const validateListingAvailability = async ({
  listing,
  startDate,
  endDate,
  guests,
}) => {
  const normalizedStart = new Date(startDate);
  const normalizedEnd = new Date(endDate);

  if (Number.isNaN(normalizedStart.getTime()) || Number.isNaN(normalizedEnd.getTime())) {
    return { available: false, reason: 'Invalid booking dates supplied' };
  }

  if (normalizedEnd < normalizedStart) {
    return { available: false, reason: 'End date must be after start date' };
  }

  if (listing.type === 'room' && normalizedEnd <= normalizedStart) {
    return { available: false, reason: 'Check-out must be at least one day after check-in' };
  }

  const existingBookings = await getExistingBookingsForRange({
    listingId: listing._id,
    startDate: normalizedStart,
    endDate: normalizedEnd,
  });

  const reservedGuests = existingBookings.reduce((sum, booking) => sum + booking.guests, 0);

  if (reservedGuests + Number(guests) > listing.capacity) {
    return {
      available: false,
      reason: 'Capacity exceeded for selected dates',
    };
  }

  if (listing.availableDates?.length) {
    const requestedDate = normalizedStart.toDateString();
    const listedDate = listing.availableDates.some(
      (date) => new Date(date).toDateString() === requestedDate
    );

    if (!listedDate) {
      return {
        available: false,
        reason: 'This date is not offered for the selected experience',
      };
    }
  }

  return { available: true, reason: 'Available' };
};
