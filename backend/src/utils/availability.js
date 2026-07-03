import Booking from '../models/Booking.js';

export const getBookedDateRanges = async (listingId, fromDate, toDate) => {
  const bookings = await Booking.find({
    listing: listingId,
    status: { $in: ['confirmed', 'pending', 'blocked'] },
    paymentStatus: { $ne: 'failed' },
    startDate: { $lt: new Date(toDate) },
    endDate: { $gt: new Date(fromDate) },
  }).select('startDate endDate status blockNote');

  return bookings.map((b) => ({
    startDate: b.startDate,
    endDate: b.endDate,
    status: b.status,
    blockNote: b.blockNote,
  }));
};

export const getNextAvailableWindow = async (listingId, nights, fromDate, maxDaysAhead = 90) => {
  const ceiling = new Date(fromDate);
  ceiling.setDate(ceiling.getDate() + maxDaysAhead);

  const bookedRanges = await getBookedDateRanges(listingId, fromDate, ceiling);

  const isWindowFree = (start, end) =>
    !bookedRanges.some(
      (r) => r.status === 'confirmed' && r.startDate < end && r.endDate > start
    );

  const cursor = new Date(fromDate);
  while (cursor < ceiling) {
    const windowEnd = new Date(cursor);
    windowEnd.setDate(windowEnd.getDate() + nights);
    if (windowEnd > ceiling) break;
    if (isWindowFree(cursor, windowEnd)) {
      return { startDate: new Date(cursor), endDate: windowEnd };
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
};

export const getNextAvailableWindowMulti = async (listingIds, nights, fromDate, maxDaysAhead = 90) => {
  const ceiling = new Date(fromDate);
  ceiling.setDate(ceiling.getDate() + maxDaysAhead);

  const rangesPerListing = await Promise.all(
    listingIds.map((listingId) => getBookedDateRanges(listingId, fromDate, ceiling))
  );
  const bookedRanges = rangesPerListing.flat();

  const isWindowFree = (start, end) =>
    !bookedRanges.some(
      (r) => r.status === 'confirmed' && new Date(r.startDate) < end && new Date(r.endDate) > start
    );

  const cursor = new Date(fromDate);
  while (cursor < ceiling) {
    const windowEnd = new Date(cursor);
    windowEnd.setDate(windowEnd.getDate() + nights);
    if (windowEnd > ceiling) break;
    if (isWindowFree(cursor, windowEnd)) {
      return { startDate: new Date(cursor), endDate: windowEnd };
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
};

export const getPreviousAvailableWindow = async (listingId, nights, fromDate, maxDaysBack = 90) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const floor = new Date(fromDate);
  floor.setDate(floor.getDate() - maxDaysBack);

  const searchFloor = floor < today ? today : floor;

  const bookedRanges = await getBookedDateRanges(listingId, searchFloor, fromDate);

  const isWindowFree = (start, end) =>
    !bookedRanges.some(
      (r) => r.status === 'confirmed' && r.startDate < end && r.endDate > start
    );

  const cursor = new Date(fromDate);
  cursor.setDate(cursor.getDate() - nights);

  while (cursor >= searchFloor) {
    const windowEnd = new Date(cursor);
    windowEnd.setDate(windowEnd.getDate() + nights);
    if (isWindowFree(cursor, windowEnd)) {
      return { startDate: new Date(cursor), endDate: windowEnd };
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return null;
};

export const isWindowAvailable = async (listingId, startDate, endDate) => {
  const bookedRanges = await getBookedDateRanges(listingId, startDate, endDate);
  return !bookedRanges.some(
    (r) => r.status === 'confirmed' && r.startDate < endDate && r.endDate > startDate
  );
};

// For a multi-room bundle (Group Booking / Full House), identifies which of
// the requested listings actually has a conflicting booking for the window —
// so the UI can tell the guest *which* room is the blocker, not just that
// "the bundle" is unavailable.
export const getBlockingListingIds = async (listingIds, startDate, endDate) => {
  const results = await Promise.all(
    listingIds.map(async (listingId) => {
      const ranges = await getBookedDateRanges(listingId, startDate, endDate);
      const blocked = ranges.some(
        (r) =>
          (r.status === 'confirmed' || r.status === 'blocked') &&
          new Date(r.startDate) < endDate &&
          new Date(r.endDate) > startDate
      );
      return blocked ? listingId : null;
    })
  );

  return results.filter(Boolean);
};

export const getExistingBookingsForRange = async ({
  listingId,
  startDate,
  endDate,
  statuses = ['pending', 'confirmed'],
  excludeBookingId = null,
}) => {
  const query = {
    listing: listingId,
    paymentStatus: { $ne: 'failed' },
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) },
  };

  // A pending booking only blocks other guests once it's actually been paid
  // (deposit or full). An unpaid pending booking (payment never completed)
  // must never hold the date, no matter how recently it was created.
  if (statuses.includes('pending')) {
    query.$or = [
      { status: { $in: statuses.filter((s) => s !== 'pending') } },
      { status: 'pending', paymentStatus: { $in: ['paid', 'partially_paid'] } },
    ];
  } else {
    query.status = { $in: statuses };
  }

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  return Booking.find(query);
};

// A room-type booking sits in `pending`+unpaid state from creation until the
// guest completes payment (or the payment link expires/fails and it's
// auto-cancelled). During that window it intentionally doesn't block other
// guests, but it must block the SAME guest from creating a duplicate booking
// for the same room and dates — otherwise a customer who starts checkout
// twice (two tabs, retrying after a declined card, re-adding the same room
// to a group cart) ends up with two pending bookings that can both get paid
// later, double-booking the room.
export const getOwnPendingHold = async ({
  listingId,
  startDate,
  endDate,
  contactEmail,
  userId,
  excludeBookingId = null,
}) => {
  const normalizedEmail = contactEmail ? String(contactEmail).trim().toLowerCase() : null;
  if (!normalizedEmail && !userId) return null;

  const query = {
    listing: listingId,
    status: 'pending',
    startDate: { $lt: new Date(endDate) },
    endDate: { $gt: new Date(startDate) },
  };
  if (excludeBookingId) query._id = { $ne: excludeBookingId };

  const candidates = await Booking.find(query).select('user contactEmail');

  return (
    candidates.find(
      (b) =>
        (userId && b.user && String(b.user) === String(userId)) ||
        (normalizedEmail && b.contactEmail && b.contactEmail.trim().toLowerCase() === normalizedEmail)
    ) || null
  );
};

export const validateListingAvailability = async ({
  listing,
  startDate,
  endDate,
  guests,
  contactEmail,
  userId,
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
    const hasConfirmedOverlap = existingBookings.some((booking) => booking.status === 'confirmed' || booking.status === 'blocked');
    if (hasConfirmedOverlap) {
      return {
        available: false,
        reason: 'Room is fully booked for the selected dates',
      };
    }

    const ownHold = await getOwnPendingHold({
      listingId: listing._id,
      startDate: normalizedStart,
      endDate: normalizedEnd,
      contactEmail,
      userId,
    });
    if (ownHold) {
      return {
        available: false,
        reason: 'You already have a booking in progress for this room on these dates. Complete or cancel that payment before booking it again.',
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
