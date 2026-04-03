import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { createNotification, notifyAdmins } from '../utils/notifications.js';
import { getExistingBookingsForRange, validateListingAvailability } from '../utils/availability.js';

export const createBooking = async (req, res, next) => {
  try {
    const {
      listingId,
      startDate,
      endDate,
      guests,
      contactName,
      contactEmail,
      contactPhone,
      specialRequests,
    } = req.body;

    const listing = await Listing.findById(listingId);

    if (!listing || !listing.active) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const normalizedStartDate = new Date(startDate);
    const normalizedEndDate = new Date(endDate);
    const normalizedGuests = Number(guests);

    const availability = await validateListingAvailability({
      listing,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
    });

    if (!availability.available) {
      res.status(400);
      throw new Error(availability.reason);
    }

    const pricing = await calculateBookingPrice({
      listing,
      bookingType: listing.type,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
    });

    const booking = await Booking.create({
      bookingType: listing.type,
      listing: listing._id,
      user: req.user._id,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
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

    await createNotification({
      userId: req.user._id,
      title: 'Booking request received',
      message: `Your ${listing.type} booking for ${listing.name} has been placed successfully.`,
      type: 'booking',
    });

    await notifyAdmins({
      title: 'New booking received',
      message: `${req.user.name} placed a booking for ${listing.name}.`,
      type: 'booking',
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('listing')
      .populate('user', 'name email phone');

    res.status(201).json({ booking: populatedBooking });
  } catch (error) {
    next(error);
  }
};

export const createAdminManualRoomBooking = async (req, res, next) => {
  try {
    const {
      listingId,
      startDate,
      endDate,
      guests = 1,
      contactName,
      contactEmail,
      contactPhone = '',
      specialRequests = '',
    } = req.body;

    if (!listingId || !startDate || !endDate || !contactName || !contactEmail) {
      res.status(400);
      throw new Error('Room, dates, contact name, and contact email are required');
    }

    const listing = await Listing.findById(listingId);

    if (!listing || !listing.active || listing.type !== 'room') {
      res.status(404);
      throw new Error('Room listing not found');
    }

    const normalizedStartDate = new Date(startDate);
    const normalizedEndDate = new Date(endDate);
    const normalizedGuests = Number(guests);

    const availability = await validateListingAvailability({
      listing,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
    });

    if (!availability.available) {
      res.status(400);
      throw new Error(availability.reason);
    }

    const pricing = await calculateBookingPrice({
      listing,
      bookingType: 'room',
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
    });

    const booking = await Booking.create({
      bookingType: 'room',
      listing: listing._id,
      user: req.user._id,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      pricingBreakdown: {
        basePrice: pricing.basePrice,
        adjustments: pricing.adjustments,
      },
      paymentMethod: 'manual',
      status: 'confirmed',
      paymentStatus: 'pending',
      contactName: String(contactName).trim(),
      contactEmail: String(contactEmail).trim().toLowerCase(),
      contactPhone: String(contactPhone || '').trim(),
      specialRequests: String(specialRequests || '').trim(),
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('listing')
      .populate('user', 'name email phone');

    res.status(201).json({ booking: populatedBooking });
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('listing')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
};

export const cancelMyBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('listing');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    booking.status = 'cancelled';
    if (booking.paymentStatus === 'paid') {
      booking.paymentStatus = 'refunded';
    }
    await booking.save();

    await createNotification({
      userId: req.user._id,
      title: 'Booking cancelled',
      message: `Your booking for ${booking.listing.name} has been cancelled.`,
      type: 'booking',
    });

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};

export const getAllBookings = async (req, res, next) => {
  try {
    const { type, status, paymentStatus, user, startDate, endDate } = req.query;
    const query = {};

    if (type) query.bookingType = type;
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (user) query.user = user;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const bookings = await Booking.find(query)
      .populate('listing')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
};

export const updateBookingStatus = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('listing')
      .populate('user', 'name email');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    const nextStatus = req.body.status ?? booking.status;

    if (nextStatus === 'confirmed' && booking.listing?.type === 'room') {
      const overlappingConfirmedBookings = await getExistingBookingsForRange({
        listingId: booking.listing._id,
        startDate: booking.startDate,
        endDate: booking.endDate,
        statuses: ['confirmed'],
        excludeBookingId: booking._id,
      });

      if (overlappingConfirmedBookings.length) {
        res.status(400);
        throw new Error('Room already has a confirmed booking for these dates');
      }
    }

    booking.status = nextStatus;
    booking.paymentStatus = req.body.paymentStatus ?? booking.paymentStatus;
    await booking.save();

    await createNotification({
      userId: booking.user._id,
      title: 'Booking updated',
      message: `Your booking for ${booking.listing.name} is now ${booking.status}.`,
      type: 'booking',
    });

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};
