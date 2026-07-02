import Booking from '../models/Booking.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { validateListingAvailability } from '../utils/availability.js';
import { createNotification, notifyAdmins, formatBookingNotificationDetails } from '../utils/notifications.js';
import { writeBookingToSheet, writeFullBookingToSheet, isSheetsConfigured } from '../utils/googleSheets.js';

// Awaited before returning so the initial (pending) sheet write can't race
// the later "confirmed" write from payment verification — see the matching
// comment in bookingController.js.
function syncToSheet(booking) {
  if (!isSheetsConfigured()) return Promise.resolve();
  return Promise.all([
    writeBookingToSheet(booking).catch(() => {}),
    writeFullBookingToSheet(booking).catch(() => {}),
  ]);
}

export const createRoomBooking = async ({
  listing,
  startDate,
  endDate,
  adultGuests,
  childGuests = 0,
  pets = 0,
  vegCount = 0,
  nonVegCount = 0,
  contactName,
  contactEmail,
  contactPhone,
  specialRequests = '',
  payInFullRequested = false,
  user = null,
  deferSideEffects = false,
}) => {
  const guests = adultGuests + childGuests;

  if (Number(vegCount || 0) + Number(nonVegCount || 0) !== guests) {
    throw new Error('Meal preference is required for every guest');
  }

  const availability = await validateListingAvailability({ listing, startDate, endDate, guests });

  if (!availability.available) {
    throw new Error(availability.reason);
  }

  const pricing = await calculateBookingPrice({
    listing,
    bookingType: 'room',
    startDate,
    endDate,
    guests,
    adultGuests,
    childGuests,
    pets,
  });

  const booking = await Booking.create({
    bookingType: 'room',
    listing: listing._id,
    user: user?._id ?? null,
    startDate,
    endDate,
    guests,
    adultGuests,
    childGuests,
    pets,
    vegCount,
    nonVegCount,
    unitPrice: pricing.unitPrice,
    totalPrice: pricing.totalPrice,
    pricingBreakdown: {
      basePrice: pricing.basePrice,
      adjustments: pricing.adjustments,
    },
    paymentMethod: 'manual',
    status: 'pending',
    paymentStatus: 'pending',
    payInFullRequested,
    contactName,
    contactEmail,
    contactPhone,
    specialRequests,
  });

  if (user) {
    await createNotification({
      userId: user._id,
      title: 'Booking request received',
      message: `Your room booking for ${listing.name} has been placed successfully.`,
      type: 'booking',
    });
  }

  const populatedBooking = await Booking.findById(booking._id)
    .populate('listing')
    .populate('user', 'name email phone');

  if (!deferSideEffects) {
    await runBookingSideEffects(populatedBooking, contactName);
  }

  return populatedBooking;
};

// Admin emails + Google Sheet writes are slow (several seconds combined).
// Callers on a tight budget (the WhatsApp webhook runs inside Vercel's 10s
// limit) pass deferSideEffects and invoke this after replying to the guest.
export const runBookingSideEffects = async (booking, contactName) => {
  const listing = booking.listing;

  await notifyAdmins({
    title: 'New booking received',
    message: `${contactName} placed a booking for ${listing.name} via WhatsApp.`,
    emailBody: `${contactName} placed a booking for ${listing.name} via WhatsApp.\n\n${formatBookingNotificationDetails({
      ...booking.toObject(),
      listing,
    })}`,
    type: 'booking',
  });

  await syncToSheet(booking);
};
