import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { createNotification, notifyAdmins } from '../utils/notifications.js';
import { validateListingAvailability } from '../utils/availability.js';

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
      paymentMethod = 'manual',
    } = req.body;

    const listing = await Listing.findById(listingId);

    if (!listing || !listing.active) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const availability = await validateListingAvailability({
      listing,
      startDate,
      endDate,
      guests,
    });

    if (!availability.available) {
      res.status(400);
      throw new Error(availability.reason);
    }

    const pricing = await calculateBookingPrice({
      listing,
      bookingType: listing.type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      guests: Number(guests),
    });

    const booking = await Booking.create({
      bookingType: listing.type,
      listing: listing._id,
      user: req.user._id,
      startDate,
      endDate,
      guests,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      pricingBreakdown: {
        basePrice: pricing.basePrice,
        adjustments: pricing.adjustments,
      },
      paymentMethod,
      status: paymentMethod === 'manual' ? 'pending' : 'confirmed',
      paymentStatus: paymentMethod === 'manual' ? 'pending' : 'paid',
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

    booking.status = req.body.status ?? booking.status;
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
