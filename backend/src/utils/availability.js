import Booking from '../models/Booking.js';

export const getExistingBookingsForRange = async ({
  listingId,
  startDate,
  endDate,
  statuses = ['pending', 'confirmed'],
  excludeBookingId = null,
}) => {
  const query = {
    listing: listingId,
    status: { $in: statuses },
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  return Booking.find(query);
};

export const validateListingAvailability = async ({
  listing,
  startDate,
  endDate,
  guests,
}) => {
  const normalizedStart = new Date(startDate);
  const normalizedEnd = new Date(endDate);
  const requestedGuests = Number(guests);

  if (Number.isNaN(normalizedStart.getTime()) || Number.isNaN(normalizedEnd.getTime())) {
    return { available: false, reason: 'Invalid booking dates supplied' };
  }

  if (Number.isNaN(requestedGuests) || requestedGuests < 1) {
    return { available: false, reason: 'Invalid guest count supplied' };
  }

  if (normalizedEnd < normalizedStart) {
    return { available: false, reason: 'End date must be after start date' };
  }

  if (listing.type === 'room' && normalizedEnd <= normalizedStart) {
    return { available: false, reason: 'Check-out must be at least one day after check-in' };
  }

  if (requestedGuests > listing.capacity) {
    return {
      available: false,
      reason: `Guest count exceeds maximum room occupancy of ${listing.capacity}`,
    };
  }

  const existingBookings = await getExistingBookingsForRange({
    listingId: listing._id,
    startDate: normalizedStart,
    endDate: normalizedEnd,
  });

  if (listing.type === 'room') {
    const hasConfirmedOverlap = existingBookings.some((booking) => booking.status === 'confirmed');
    if (hasConfirmedOverlap) {
      return {
        available: false,
        reason: 'Room is fully booked for the selected dates',
      };
    }
  } else {
    const reservedGuests = existingBookings.reduce((sum, booking) => sum + booking.guests, 0);

    if (reservedGuests + requestedGuests > listing.capacity) {
      return {
        available: false,
        reason: 'Capacity exceeded for selected dates',
      };
    }
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
