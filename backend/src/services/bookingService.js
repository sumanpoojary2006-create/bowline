import Booking from '../models/Booking.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { validateListingAvailability } from '../utils/availability.js';
import { createNotification, notifyAdmins } from '../utils/notifications.js';
import { writeBookingToSheet, writeFullBookingToSheet, isSheetsConfigured } from '../utils/googleSheets.js';

function syncToSheet(booking) {
  if (!isSheetsConfigured()) return;
  writeBookingToSheet(booking).catch(() => {});
  writeFullBookingToSheet(booking).catch(() => {});
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
  user = null,
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

  await notifyAdmins({
    title: 'New booking received',
    message: `${contactName} placed a booking for ${listing.name} via WhatsApp.`,
    type: 'booking',
  });

  const populatedBooking = await Booking.findById(booking._id)
    .populate('listing')
    .populate('user', 'name email phone');

  syncToSheet(populatedBooking);

  return populatedBooking;
};
