import { randomUUID } from 'crypto';
import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { findValidCoupon, normalizeCouponCode } from '../utils/coupons.js';
import { createNotification, notifyAdmins } from '../utils/notifications.js';
import { getExistingBookingsForRange, validateListingAvailability } from '../utils/availability.js';
import { writeBookingToSheet, writeFullBookingToSheet, clearBookingFromSheet, isSheetsConfigured } from '../utils/googleSheets.js';

function syncToSheet(booking) {
  if (!isSheetsConfigured()) return;
  writeBookingToSheet(booking).catch(() => {});
  writeFullBookingToSheet(booking).catch(() => {});
}

function unsyncFromSheet(booking) {
  if (!isSheetsConfigured()) return;
  clearBookingFromSheet(booking).catch(() => {});
}

export const createBooking = async (req, res, next) => {
  try {
    const {
      listingId,
      startDate,
      endDate,
      guests,
      adultGuests,
      childGuests = 0,
      pets = 0,
      vegCount = 0,
      nonVegCount = 0,
      contactName,
      contactEmail,
      contactPhone,
      specialRequests,
      couponCode,
    } = req.body;

    const listing = await Listing.findById(listingId);

    if (!listing || !listing.active) {
      res.status(404);
      throw new Error('Listing not found');
    }

    const normalizedStartDate = new Date(startDate);
    const normalizedEndDate = new Date(endDate);
    const normalizedAdults = Number(adultGuests ?? guests ?? 1);
    const normalizedChildren = Number(childGuests || 0);
    const normalizedPets = Number(pets || 0);
    const normalizedVeg = Number(vegCount || 0);
    const normalizedNonVeg = Number(nonVegCount || 0);
    const normalizedGuests = Number(guests ?? normalizedAdults + normalizedChildren);

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
      adultGuests: normalizedAdults,
      childGuests: normalizedChildren,
      pets: normalizedPets,
    });

    let couponDiscount = 0;
    let coupon = null;
    if (normalizeCouponCode(couponCode)) {
      const couponResult = await findValidCoupon(couponCode, pricing.totalPrice);
      coupon = couponResult.coupon;
      couponDiscount = couponResult.discount;
    }

    const booking = await Booking.create({
      bookingType: listing.type,
      listing: listing._id,
      user: req.user?._id ?? null,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
      adultGuests: normalizedAdults,
      childGuests: normalizedChildren,
      pets: normalizedPets,
      vegCount: normalizedVeg,
      nonVegCount: normalizedNonVeg,
      unitPrice: pricing.unitPrice,
      totalPrice: Math.max(pricing.totalPrice - couponDiscount, 0),
      pricingBreakdown: {
        basePrice: pricing.basePrice,
        adjustments: couponDiscount > 0 ? [...pricing.adjustments, `Coupon ${coupon.code}: -₹${couponDiscount}`] : pricing.adjustments,
        coupon: coupon
          ? {
              code: coupon.code,
              title: coupon.title,
              discount: couponDiscount,
            }
          : undefined,
      },
      paymentMethod: 'manual',
      status: 'pending',
      paymentStatus: 'pending',
      contactName,
      contactEmail,
      contactPhone,
      specialRequests,
    });

    if (req.user) {
      await createNotification({
        userId: req.user._id,
        title: 'Booking request received',
        message: `Your ${listing.type} booking for ${listing.name} has been placed successfully.`,
        type: 'booking',
      });
    }

    await notifyAdmins({
      title: 'New booking received',
      message: `${contactName} placed a booking for ${listing.name}.`,
      type: 'booking',
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('listing')
      .populate('user', 'name email phone');

    syncToSheet(populatedBooking);
    res.status(201).json({ booking: populatedBooking });
  } catch (error) {
    next(error);
  }
};

export const createMultiBooking = async (req, res, next) => {
  try {
    const {
      items,
      contactName,
      contactEmail,
      contactPhone,
      specialRequests,
      isGroupBooking,
      groupName,
      couponCode,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('At least one booking item is required');
    }

    const groupId = isGroupBooking || items.length > 1 ? randomUUID() : null;

    const validationErrors = [];
    const preparedItems = [];

    for (const item of items) {
      const { listingId, startDate, endDate, guests, adultGuests, childGuests = 0, pets = 0, vegCount = 0, nonVegCount = 0 } = item;
      const listing = await Listing.findById(listingId);

      if (!listing || !listing.active) {
        validationErrors.push(`Listing ${listingId} not found`);
        continue;
      }

      const normalizedStart = new Date(startDate);
      const normalizedEnd = new Date(endDate);
      const normalizedAdults = Number(adultGuests ?? guests ?? 1);
      const normalizedChildren = Number(childGuests || 0);
      const normalizedPets = Number(pets || 0);
      const normalizedVeg = Number(vegCount || 0);
      const normalizedNonVeg = Number(nonVegCount || 0);
      const normalizedGuests = Number(guests ?? normalizedAdults + normalizedChildren) || 1;

      const availability = await validateListingAvailability({
        listing,
        startDate: normalizedStart,
        endDate: normalizedEnd,
        guests: normalizedGuests,
      });

      if (!availability.available) {
        validationErrors.push(`${listing.name}: ${availability.reason}`);
        continue;
      }

      const pricing = await calculateBookingPrice({
        listing,
        bookingType: listing.type,
        startDate: normalizedStart,
        endDate: normalizedEnd,
        guests: normalizedGuests,
        adultGuests: normalizedAdults,
        childGuests: normalizedChildren,
        pets: normalizedPets,
      });

      preparedItems.push({
        listing,
        normalizedStart,
        normalizedEnd,
        normalizedGuests,
        normalizedAdults,
        normalizedChildren,
        normalizedPets,
        normalizedVeg,
        normalizedNonVeg,
        pricing,
      });
    }

    if (validationErrors.length > 0) {
      res.status(400);
      throw new Error(validationErrors.join('; '));
    }

    const subtotal = preparedItems.reduce((sum, item) => sum + item.pricing.totalPrice, 0);
    let coupon = null;
    let couponDiscount = 0;

    if (normalizeCouponCode(couponCode)) {
      const couponResult = await findValidCoupon(couponCode, subtotal);
      coupon = couponResult.coupon;
      couponDiscount = couponResult.discount;
    }

    let remainingDiscount = couponDiscount;

    const createdBookings = await Promise.all(
      preparedItems.map(({ listing, normalizedStart, normalizedEnd, normalizedGuests, normalizedAdults, normalizedChildren, normalizedPets, normalizedVeg, normalizedNonVeg, pricing }, index) => {
        const itemDiscount =
          coupon && subtotal > 0
            ? index === preparedItems.length - 1
              ? remainingDiscount
              : Math.min(Math.round(couponDiscount * (pricing.totalPrice / subtotal)), remainingDiscount)
            : 0;
        remainingDiscount -= itemDiscount;

        return Booking.create({
          bookingType: listing.type,
          listing: listing._id,
          user: req.user._id,
          startDate: normalizedStart,
          endDate: normalizedEnd,
          guests: normalizedGuests,
          adultGuests: normalizedAdults,
          childGuests: normalizedChildren,
          pets: normalizedPets,
          vegCount: normalizedVeg,
          nonVegCount: normalizedNonVeg,
          unitPrice: pricing.unitPrice,
          totalPrice: Math.max(pricing.totalPrice - itemDiscount, 0),
          pricingBreakdown: {
            basePrice: pricing.basePrice,
            adjustments: itemDiscount > 0 ? [...pricing.adjustments, `Coupon ${coupon.code}: -₹${itemDiscount}`] : pricing.adjustments,
            coupon: coupon
              ? {
                  code: coupon.code,
                  title: coupon.title,
                  discount: itemDiscount,
                }
              : undefined,
          },
          paymentMethod: 'manual',
          status: 'pending',
          paymentStatus: 'pending',
          contactName,
          contactEmail,
          contactPhone: contactPhone || '',
          specialRequests: specialRequests || '',
          groupId,
          groupName: groupName || '',
          isGroupBooking: Boolean(isGroupBooking),
        });
      })
    );

    await createNotification({
      userId: req.user._id,
      title: 'Booking request received',
      message: `Your booking for ${createdBookings.length} room${createdBookings.length > 1 ? 's' : ''} has been placed successfully.`,
      type: 'booking',
    });

    await notifyAdmins({
      title: 'New booking received',
      message: `${req.user.name} placed a booking for ${createdBookings.length} room${createdBookings.length > 1 ? 's' : ''}.`,
      type: 'booking',
    });

    const populatedBookings = await Booking.find({ _id: { $in: createdBookings.map((b) => b._id) } })
      .populate('listing')
      .populate('user', 'name email phone');

    populatedBookings.forEach(syncToSheet);

    res.status(201).json({ bookings: populatedBookings, groupId });
  } catch (error) {
    next(error);
  }
};

export const validateCoupon = async (req, res, next) => {
  try {
    const { couponCode, subtotal } = req.body;
    const { coupon, discount } = await findValidCoupon(couponCode, Number(subtotal || 0));

    res.json({
      coupon: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minBookingAmount: coupon.minBookingAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
      },
      discount,
      finalTotal: Math.max(Number(subtotal || 0) - discount, 0),
    });
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
      adultGuests,
      childGuests = 0,
      pets = 0,
      vegCount = 0,
      nonVegCount = 0,
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
    const normalizedAdults = Number(adultGuests ?? guests);
    const normalizedChildren = Number(childGuests || 0);
    const normalizedPets = Number(pets || 0);
    const normalizedVeg = Number(vegCount || 0);
    const normalizedNonVeg = Number(nonVegCount || 0);
    const normalizedGuests = Number(guests ?? normalizedAdults + normalizedChildren);

    const availability = await validateListingAvailability({
      listing,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
      adultGuests: normalizedAdults,
      childGuests: normalizedChildren,
      pets: normalizedPets,
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
      adultGuests: normalizedAdults,
      childGuests: normalizedChildren,
      pets: normalizedPets,
    });

    const booking = await Booking.create({
      bookingType: 'room',
      listing: listing._id,
      user: req.user._id,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      guests: normalizedGuests,
      adultGuests: normalizedAdults,
      childGuests: normalizedChildren,
      pets: normalizedPets,
      vegCount: normalizedVeg,
      nonVegCount: normalizedNonVeg,
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

    syncToSheet(populatedBooking);
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
    unsyncFromSheet(booking);
    writeFullBookingToSheet(booking).catch(() => {});

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

export const getCalendarBookings = async (req, res, next) => {
  try {
    const { month } = req.query;

    let rangeStart, rangeEnd;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split('-').map(Number);
      rangeStart = new Date(year, mon - 1, 1);
      rangeEnd = new Date(year, mon, 1);
    } else {
      const now = new Date();
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    const bookings = await Booking.find({
      bookingType: 'room',
      status: { $in: ['pending', 'confirmed'] },
      startDate: { $lt: rangeEnd },
      endDate: { $gt: rangeStart },
    })
      .populate('listing', 'name _id')
      .populate('user', 'name email')
      .sort({ startDate: 1 });

    res.json({ bookings, rangeStart, rangeEnd });
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

    if (nextStatus === 'cancelled') {
      unsyncFromSheet(booking);
    } else {
      syncToSheet(booking);
    }

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
