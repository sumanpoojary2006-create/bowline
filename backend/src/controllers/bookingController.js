import crypto from 'crypto';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import { calculateBookingPrice } from '../utils/pricing.js';
import { findValidCoupon, normalizeCouponCode } from '../utils/coupons.js';
import { createNotification, notifyAdmins, formatBookingNotificationDetails } from '../utils/notifications.js';
import { getExistingBookingsForRange, validateListingAvailability } from '../utils/availability.js';
import { writeBookingToSheet, writeFullBookingToSheet, clearBookingFromSheet, isSheetsConfigured } from '../utils/googleSheets.js';
import { sendBookingConfirmationEmail } from '../utils/bookingConfirmationEmail.js';
import { isEmailConfigured, sendMail } from '../utils/email.js';
import { createRazorpayOrder, createRazorpayRefund, isRazorpayConfigured } from '../utils/razorpay.js';
import { daysUntil, getCancellationRefundPercent, getRescheduleFeePercent } from '../utils/bookingPolicy.js';

function syncToSheet(booking) {
  if (!isSheetsConfigured()) return;
  writeBookingToSheet(booking).catch(() => {});
  writeFullBookingToSheet(booking).catch(() => {});
}

function unsyncFromSheet(booking) {
  if (!isSheetsConfigured()) return;
  clearBookingFromSheet(booking).catch(() => {});
}

// Only these per-person group booking tariffs are accepted from clients,
// preventing arbitrary price overrides via the multi-booking endpoint.
const ALLOWED_GROUP_RATES = [
  { weekday: 1699, weekend: 1899 }, // Group Booking 1 (10-15 guests, all rooms except Pent House)
  { weekday: 1599, weekend: 1699 }, // Group Booking 2 (16-20 guests, full house)
];

function isAllowedGroupRate(rate) {
  if (!rate) return false;
  return ALLOWED_GROUP_RATES.some(
    (allowed) => allowed.weekday === Number(rate.weekday) && allowed.weekend === Number(rate.weekend)
  );
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

    if (listing.type === 'room' && normalizedVeg + normalizedNonVeg !== normalizedGuests) {
      res.status(400);
      throw new Error('Meal preference is required for every guest');
    }

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
      emailBody: `${contactName} placed a booking for ${listing.name}.\n\n${formatBookingNotificationDetails({
        ...booking.toObject(),
        listing,
      })}`,
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
      const { listingId, startDate, endDate, guests, adultGuests, childGuests = 0, pets = 0, vegCount = 0, nonVegCount = 0, groupRate } = item;
      const appliedGroupRate = isGroupBooking && isAllowedGroupRate(groupRate)
        ? { weekday: Number(groupRate.weekday), weekend: Number(groupRate.weekend) }
        : null;
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

      if (listing.type === 'room' && normalizedVeg + normalizedNonVeg !== normalizedGuests) {
        validationErrors.push(`${listing.name}: Meal preference is required for every guest`);
        continue;
      }

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
        groupRate: appliedGroupRate,
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
          user: req.user?._id ?? null,
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

    if (req.user) {
      await createNotification({
        userId: req.user._id,
        title: 'Booking request received',
        message: `Your booking for ${createdBookings.length} room${createdBookings.length > 1 ? 's' : ''} has been placed successfully.`,
        type: 'booking',
      });
    }

    const bookerName = req.user?.name || contactName;
    await notifyAdmins({
      title: 'New booking received',
      message: `${bookerName} placed a booking for ${createdBookings.length} room${createdBookings.length > 1 ? 's' : ''}.`,
      emailBody: `${bookerName} placed a booking for ${createdBookings.length} room${createdBookings.length > 1 ? 's' : ''}.\n\n${formatBookingNotificationDetails(
        createdBookings.map((booking, index) => ({ ...booking.toObject(), listing: preparedItems[index].listing }))
      )}`,
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
      source = 'whatsapp',
    } = req.body;

    const allowedSources = ['website', 'admin', 'sheet', 'airbnb', 'whatsapp'];
    const normalizedSource = allowedSources.includes(source) ? source : 'whatsapp';

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
      paymentStatus: 'paid',
      contactName: String(contactName).trim(),
      contactEmail: String(contactEmail).trim().toLowerCase(),
      contactPhone: String(contactPhone || '').trim(),
      specialRequests: String(specialRequests || '').trim(),
      source: normalizedSource,
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate('listing')
      .populate('user', 'name email phone');

    syncToSheet(populatedBooking);

    sendBookingConfirmationEmail(populatedBooking).catch((error) => {
      console.error('Failed to send booking confirmation email', error);
    });

    res.status(201).json({ booking: populatedBooking });
  } catch (error) {
    next(error);
  }
};

// Group/Full House bundle tiers admin can book in one action. Mirrors
// frontend/src/lib/roomRates.js groupBookingTiers — keep both in sync.
const ADMIN_GROUP_BUNDLE_TIERS = {
  'except-pent-house': { label: 'Group Booking', weekday: 1699, weekend: 1899, excludePentHouse: true },
  'full-house': { label: 'Full House', weekday: 1599, weekend: 1699, excludePentHouse: false },
};

// Dormitory is marked inactive (not offered as a standalone bookable room on
// the site) but is still overflow space for both group bundles — always
// include it regardless of its `active` flag.
const DORMITORY_SLUG = 'dormitory-open-loft';

// Admin attests payment was already collected offline (advance/cash/UPI), so
// every room in the bundle is created confirmed+paid in one atomic action —
// guaranteeing none of the bundle's rooms are missed, unlike booking each
// room individually through the single-room manual-booking form.
export const createAdminGroupBooking = async (req, res, next) => {
  try {
    const {
      bundle,
      startDate,
      endDate,
      adultGuests,
      childGuests = 0,
      pets = 0,
      contactName,
      contactEmail,
      contactPhone = '',
      specialRequests = '',
      source = 'admin',
    } = req.body;

    const tier = ADMIN_GROUP_BUNDLE_TIERS[bundle];
    if (!tier) {
      res.status(400);
      throw new Error('Invalid group booking bundle');
    }

    if (!startDate || !endDate || !contactName || !contactEmail) {
      res.status(400);
      throw new Error('Dates, contact name, and contact email are required');
    }

    const normalizedStart = new Date(startDate);
    const normalizedEnd = new Date(endDate);
    const normalizedAdults = Math.max(Number(adultGuests) || 0, 1);
    const normalizedChildren = Math.max(Number(childGuests) || 0, 0);
    const totalGuests = normalizedAdults + normalizedChildren;
    const normalizedPets = Math.max(Number(pets) || 0, 0);

    const allowedSources = ['website', 'admin', 'sheet', 'airbnb', 'whatsapp'];
    const normalizedSource = allowedSources.includes(source) ? source : 'admin';

    const roomQuery = { type: 'room', $or: [{ active: true }, { slug: DORMITORY_SLUG }] };
    if (tier.excludePentHouse) roomQuery.slug = { $ne: 'pent-house' };
    const bundleRooms = await Listing.find(roomQuery).sort({ minOccupancy: -1 });

    if (!bundleRooms.length) {
      res.status(400);
      throw new Error('No active rooms found for this bundle');
    }

    // Spread guests across rooms: fill each room's minOccupancy first, then
    // round-robin the remainder without exceeding any room's actual capacity
    // (unlike the customer-facing bundle, which can overshoot a room's normal
    // max with extra mattresses — admin bookings must stay within real capacity
    // or every per-room availability check below fails with a confusing error).
    const guestCounts = bundleRooms.map((room) => Math.min(room.minOccupancy || 1, room.capacity || 1));
    let remaining = totalGuests - guestCounts.reduce((sum, count) => sum + count, 0);

    if (remaining > 0) {
      let madeProgress = true;
      while (remaining > 0 && madeProgress) {
        madeProgress = false;
        for (let index = 0; index < bundleRooms.length && remaining > 0; index += 1) {
          const capacity = bundleRooms[index].capacity || 1;
          if (guestCounts[index] < capacity) {
            guestCounts[index] += 1;
            remaining -= 1;
            madeProgress = true;
          }
        }
      }
    }

    if (remaining > 0) {
      const totalCapacity = bundleRooms.reduce((sum, room) => sum + (room.capacity || 1), 0);
      res.status(400);
      throw new Error(
        `${totalGuests} guests exceed this bundle's combined room capacity of ${totalCapacity}. Activate more rooms or reduce the guest count.`
      );
    }

    const validationErrors = [];
    const preparedItems = [];

    for (let index = 0; index < bundleRooms.length; index += 1) {
      const room = bundleRooms[index];
      const roomGuests = guestCounts[index];

      const availability = await validateListingAvailability({
        listing: room,
        startDate: normalizedStart,
        endDate: normalizedEnd,
        guests: roomGuests,
      });

      if (!availability.available) {
        validationErrors.push(`${room.name}: ${availability.reason}`);
        continue;
      }

      const pricing = await calculateBookingPrice({
        listing: room,
        bookingType: 'room',
        startDate: normalizedStart,
        endDate: normalizedEnd,
        guests: roomGuests,
        adultGuests: roomGuests,
        childGuests: 0,
        pets: index === 0 ? normalizedPets : 0,
        groupRate: { weekday: tier.weekday, weekend: tier.weekend },
      });

      preparedItems.push({ room, roomGuests, pets: index === 0 ? normalizedPets : 0, pricing });
    }

    if (validationErrors.length > 0) {
      res.status(400);
      throw new Error(validationErrors.join('; '));
    }

    const groupId = randomUUID();

    const createdBookings = await Promise.all(
      preparedItems.map(({ room, roomGuests, pets: roomPets, pricing }) =>
        Booking.create({
          bookingType: 'room',
          listing: room._id,
          user: null,
          startDate: normalizedStart,
          endDate: normalizedEnd,
          guests: roomGuests,
          adultGuests: roomGuests,
          childGuests: 0,
          pets: roomPets,
          vegCount: 0,
          nonVegCount: 0,
          unitPrice: pricing.unitPrice,
          totalPrice: pricing.totalPrice,
          pricingBreakdown: {
            basePrice: pricing.basePrice,
            adjustments: pricing.adjustments,
          },
          paymentMethod: 'manual',
          status: 'confirmed',
          paymentStatus: 'paid',
          contactName: String(contactName).trim(),
          contactEmail: String(contactEmail).trim().toLowerCase(),
          contactPhone: String(contactPhone || '').trim(),
          specialRequests: String(specialRequests || '').trim(),
          source: normalizedSource,
          groupId,
          groupName: tier.label,
          isGroupBooking: true,
        })
      )
    );

    const populatedBookings = await Booking.find({ _id: { $in: createdBookings.map((b) => b._id) } })
      .populate('listing')
      .populate('user', 'name email phone');

    populatedBookings.forEach(syncToSheet);

    sendBookingConfirmationEmail(populatedBookings).catch((error) => {
      console.error('Failed to send booking confirmation email', error);
    });

    res.status(201).json({ bookings: populatedBookings, groupId });
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
    const { type, status, paymentStatus, source, user, startDate, endDate } = req.query;
    const query = {};

    if (type) query.bookingType = type;
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (source) query.source = source;
    if (user) query.user = user;

    // Unpaid bookings are usually abandoned checkouts (payment never completed
    // or was cancelled) - hide them from the default admin view unless the
    // admin explicitly asks for pending/unpaid bookings.
    if (!status && !paymentStatus) {
      query.$or = [{ status: { $ne: 'pending' } }, { paymentStatus: 'paid' }];
    }
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

export const adminCancelWithRefund = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('listing')
      .populate('user', 'name email');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled') {
      res.status(400);
      throw new Error('Booking is already cancelled');
    }

    const refundPercent = Math.min(100, Math.max(0, Number(req.body.refundPercent ?? 0)));

    if (booking.paymentStatus === 'paid' && refundPercent > 0) {
      if (!booking.razorpayPaymentId) {
        res.status(400);
        throw new Error('No Razorpay payment ID on record — cannot process refund');
      }
      if (!isRazorpayConfigured()) {
        res.status(500);
        throw new Error('Razorpay is not configured');
      }

      const refundAmount = Math.round(booking.totalPrice * (refundPercent / 100) * 100);
      const refund = await createRazorpayRefund({
        paymentId: booking.razorpayPaymentId,
        amount: refundAmount,
        notes: { bookingId: String(booking._id), reason: 'admin_cancellation', refundPercent: String(refundPercent) },
      });

      booking.razorpayRefundId = refund.id;
      booking.refundAmount = refundAmount / 100;
      booking.refundPercentage = refundPercent;
      booking.paymentStatus = refundPercent === 100 ? 'refunded' : 'partially_refunded';
    }

    booking.status = 'cancelled';
    await booking.save();

    unsyncFromSheet(booking);
    writeFullBookingToSheet(booking).catch(() => {});

    if (booking.contactEmail && isEmailConfigured('booking')) {
      const refundNote =
        booking.refundAmount > 0
          ? ` A refund of ₹${booking.refundAmount} (${refundPercent}%) has been initiated to your original payment method.`
          : '';
      sendMail({
        to: booking.contactEmail,
        subject: `Booking Cancelled — ${booking.listing?.name}`,
        text: `Hi ${booking.contactName},\n\nYour booking for ${booking.listing?.name} has been cancelled by Bowline.${refundNote}\n\nBowline Nature Stay`,
        kind: 'booking',
      }).catch(() => {});
    }

    res.json({ booking });
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

    const previousStatus = booking.status;
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
      writeFullBookingToSheet(booking).catch(() => {});
    } else {
      syncToSheet(booking);
    }

    if (booking.user) {
      await createNotification({
        userId: booking.user._id,
        title: 'Booking updated',
        message: `Your booking for ${booking.listing.name} is now ${booking.status}.`,
        type: 'booking',
      });
    }

    if (nextStatus === 'confirmed' && previousStatus !== 'confirmed') {
      sendBookingConfirmationEmail(booking).catch((error) => {
        console.error('Failed to send booking confirmation email', error);
      });
    }

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};

// Airbnb's iCal export never includes the guest's name (confirmed by direct
// inspection of the feed), so synced bookings default to a placeholder name.
// This lets an admin fill in the real name once they know it (e.g. from the
// Airbnb app/inbox), without going through the full status-update flow.
export const updateBookingContact = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('listing')
      .populate('user', 'name email');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    const { contactName } = req.body;
    if (typeof contactName !== 'string' || !contactName.trim()) {
      res.status(400);
      throw new Error('contactName is required');
    }

    booking.contactName = contactName.trim();
    await booking.save();

    syncToSheet(booking);

    res.json({ booking });
  } catch (error) {
    next(error);
  }
};

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const matchesContact = (booking, contact) => {
  const normalizedContact = String(contact || '').trim().toLowerCase();
  if (!normalizedContact) return false;

  if (booking.contactEmail && booking.contactEmail.toLowerCase() === normalizedContact) {
    return true;
  }

  const normalizedPhone = normalizePhone(contact);
  if (normalizedPhone && normalizePhone(booking.contactPhone) === normalizedPhone) {
    return true;
  }

  return false;
};

const serializeGuestBooking = (booking) => {
  const cancellationRefundPercent = getCancellationRefundPercent(booking.startDate);
  const rescheduleFeePercent = getRescheduleFeePercent(booking.startDate);

  return {
    _id: booking._id,
    bookingType: booking.bookingType,
    listing: booking.listing,
    startDate: booking.startDate,
    endDate: booking.endDate,
    guests: booking.guests,
    adultGuests: booking.adultGuests,
    childGuests: booking.childGuests,
    totalPrice: booking.totalPrice,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    contactName: booking.contactName,
    contactEmail: booking.contactEmail,
    contactPhone: booking.contactPhone,
    specialRequests: booking.specialRequests,
    rescheduled: booking.rescheduled,
    refundAmount: booking.refundAmount,
    refundPercentage: booking.refundPercentage,
    createdAt: booking.createdAt,
    daysUntilCheckIn: daysUntil(booking.startDate),
    cancellationRefundPercent,
    rescheduleAllowed: !booking.rescheduled && booking.status !== 'cancelled' && rescheduleFeePercent !== null,
    rescheduleFeePercent: rescheduleFeePercent ?? 0,
    cancellationAllowed: !booking.rescheduled && booking.status !== 'cancelled',
  };
};

export const lookupBookings = async (req, res, next) => {
  try {
    const query = String(req.body.query || '').trim();

    if (!query) {
      res.status(400);
      throw new Error('Enter your email, phone number, or booking ID');
    }

    const conditions = [];

    if (mongoose.Types.ObjectId.isValid(query)) {
      conditions.push({ _id: query });
    }

    if (query.includes('@')) {
      conditions.push({ contactEmail: query.toLowerCase() });
    }

    const normalizedPhone = normalizePhone(query);
    if (normalizedPhone.length === 10) {
      conditions.push({ contactPhone: new RegExp(`${normalizedPhone}$`) });
    }

    if (!conditions.length) {
      res.status(400);
      throw new Error('Enter a valid email, phone number, or booking ID');
    }

    const bookings = await Booking.find({ $or: conditions })
      .populate('listing')
      .sort({ createdAt: -1 });

    res.json({ bookings: bookings.map(serializeGuestBooking) });
  } catch (error) {
    next(error);
  }
};

export const getBookingPublic = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('listing');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    res.json({ booking: serializeGuestBooking(booking) });
  } catch (error) {
    next(error);
  }
};

export const cancelGuestBooking = async (req, res, next) => {
  try {
    const { contact } = req.body;
    const booking = await Booking.findById(req.params.id).populate('listing');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    if (!matchesContact(booking, contact)) {
      res.status(403);
      throw new Error('Contact details do not match this booking');
    }

    if (booking.status === 'cancelled') {
      res.status(400);
      throw new Error('This booking is already cancelled');
    }

    if (booking.rescheduled) {
      res.status(400);
      throw new Error('This booking has been rescheduled and can no longer be cancelled');
    }

    const refundPercent = getCancellationRefundPercent(booking.startDate);

    if (booking.paymentStatus === 'paid' && refundPercent > 0) {
      if (!booking.razorpayPaymentId || !isRazorpayConfigured()) {
        res.status(503);
        throw new Error('Refunds are not available right now. Please contact us to process your cancellation.');
      }

      const refundAmount = Math.round(booking.totalPrice * (refundPercent / 100) * 100);
      const refund = await createRazorpayRefund({
        paymentId: booking.razorpayPaymentId,
        amount: refundAmount,
        notes: { bookingId: String(booking._id), reason: 'cancellation' },
      });

      booking.razorpayRefundId = refund.id;
      booking.refundAmount = refundAmount / 100;
      booking.refundPercentage = refundPercent;
      booking.paymentStatus = refundPercent === 100 ? 'refunded' : 'partially_refunded';
    }

    booking.status = 'cancelled';
    await booking.save();

    unsyncFromSheet(booking);
    writeFullBookingToSheet(booking).catch(() => {});

    await notifyAdmins({
      title: 'Booking cancelled by guest',
      message: `${booking.contactName} cancelled their booking for ${booking.listing.name}.`,
      type: 'booking',
    });

    if (booking.contactEmail && isEmailConfigured('booking')) {
      sendMail({
        to: booking.contactEmail,
        subject: `Booking Cancelled - ${booking.listing.name}`,
        text: `Hi ${booking.contactName},\n\nYour booking for ${booking.listing.name} has been cancelled.${
          booking.refundAmount > 0
            ? ` A refund of Rs ${booking.refundAmount} (${booking.refundPercentage}%) has been initiated and will reflect in your account shortly.`
            : ' Based on our cancellation policy, this booking is not eligible for a refund.'
        }\n\nBowline Nature Stay`,
        kind: 'booking',
      }).catch(() => {});
    }

    res.json({ booking: serializeGuestBooking(booking) });
  } catch (error) {
    next(error);
  }
};

const buildRescheduleQuote = async (booking, startDate, endDate) => {
  if (booking.status === 'cancelled') {
    throw new Error('This booking is cancelled and cannot be rescheduled');
  }

  if (booking.rescheduled) {
    throw new Error('This booking has already been rescheduled');
  }

  const feePercent = getRescheduleFeePercent(booking.startDate);

  if (feePercent === null) {
    throw new Error('Rescheduling is not permitted within 7 days of the check-in date');
  }

  const normalizedStart = new Date(startDate);
  const normalizedEnd = new Date(endDate);

  if (Number.isNaN(normalizedStart.getTime()) || Number.isNaN(normalizedEnd.getTime()) || normalizedEnd <= normalizedStart) {
    throw new Error('Invalid dates supplied');
  }

  const overlapping = await getExistingBookingsForRange({
    listingId: booking.listing._id,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    statuses: ['confirmed'],
    excludeBookingId: booking._id,
  });

  if (overlapping.length) {
    throw new Error('Room is fully booked for the selected dates');
  }

  const pricing = await calculateBookingPrice({
    listing: booking.listing,
    bookingType: booking.bookingType,
    startDate: normalizedStart,
    endDate: normalizedEnd,
    guests: booking.guests,
    adultGuests: booking.adultGuests,
    childGuests: booking.childGuests,
    pets: booking.pets,
  });

  const feeAmount = Math.round((pricing.totalPrice * feePercent) / 100);

  return {
    normalizedStart,
    normalizedEnd,
    pricing,
    feePercent,
    feeAmount,
  };
};

export const getRescheduleQuote = async (req, res, next) => {
  try {
    const { contact, startDate, endDate } = req.body;
    const booking = await Booking.findById(req.params.id).populate('listing');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    if (!matchesContact(booking, contact)) {
      res.status(403);
      throw new Error('Contact details do not match this booking');
    }

    const quote = await buildRescheduleQuote(booking, startDate, endDate);

    res.json({
      newTotalPrice: quote.pricing.totalPrice,
      feeAmount: quote.feeAmount,
      feePercent: quote.feePercent,
    });
  } catch (error) {
    if (!res.statusCode || res.statusCode === 200) res.status(400);
    next(error);
  }
};

export const createRescheduleFeeOrder = async (req, res, next) => {
  try {
    if (!isRazorpayConfigured()) {
      res.status(503);
      throw new Error('Online payments are not configured yet');
    }

    const { contact, startDate, endDate } = req.body;
    const booking = await Booking.findById(req.params.id).populate('listing');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    if (!matchesContact(booking, contact)) {
      res.status(403);
      throw new Error('Contact details do not match this booking');
    }

    const quote = await buildRescheduleQuote(booking, startDate, endDate);

    if (quote.feeAmount <= 0) {
      res.status(400);
      throw new Error('No reschedule fee applies to this booking');
    }

    const order = await createRazorpayOrder({
      amount: quote.feeAmount * 100,
      currency: 'INR',
      receipt: `reschedule_${String(booking._id)}_${Date.now()}`.slice(0, 40),
      notes: { bookingId: String(booking._id), type: 'reschedule-fee' },
    });

    booking.rescheduleFeeOrderId = order.id;
    await booking.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    if (!res.statusCode || res.statusCode === 200) res.status(400);
    next(error);
  }
};

export const confirmReschedule = async (req, res, next) => {
  try {
    const { contact, startDate, endDate, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const booking = await Booking.findById(req.params.id).populate('listing');

    if (!booking) {
      res.status(404);
      throw new Error('Booking not found');
    }

    if (!matchesContact(booking, contact)) {
      res.status(403);
      throw new Error('Contact details do not match this booking');
    }

    const quote = await buildRescheduleQuote(booking, startDate, endDate);

    if (quote.feeAmount > 0) {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400);
        throw new Error('Reschedule fee payment is required');
      }

      if (razorpay_order_id !== booking.rescheduleFeeOrderId) {
        res.status(400);
        throw new Error('Payment does not match this reschedule request');
      }

      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        res.status(400);
        throw new Error('Payment verification failed');
      }

      booking.rescheduleFeePaymentId = razorpay_payment_id;
      booking.rescheduleFeeAmount = quote.feeAmount;
    }

    const previousStartDate = booking.startDate;
    const previousEndDate = booking.endDate;

    booking.startDate = quote.normalizedStart;
    booking.endDate = quote.normalizedEnd;
    booking.unitPrice = quote.pricing.unitPrice;
    booking.totalPrice = quote.pricing.totalPrice;
    const newPricingBreakdown = {
      basePrice: quote.pricing.basePrice,
      adjustments: quote.pricing.adjustments,
    };
    if (booking.pricingBreakdown?.coupon?.code) {
      newPricingBreakdown.coupon = booking.pricingBreakdown.coupon;
    }
    booking.pricingBreakdown = newPricingBreakdown;
    booking.rescheduled = true;
    await booking.save();

    if (isSheetsConfigured()) {
      clearBookingFromSheet({
        listing: booking.listing,
        startDate: previousStartDate,
        endDate: previousEndDate,
      }).catch(() => {});
    }
    syncToSheet(booking);

    await notifyAdmins({
      title: 'Booking rescheduled by guest',
      message: `${booking.contactName} rescheduled their booking for ${booking.listing.name}.`,
      type: 'booking',
    });

    if (booking.contactEmail && isEmailConfigured('booking')) {
      sendMail({
        to: booking.contactEmail,
        subject: `Booking Rescheduled - ${booking.listing.name}`,
        text: `Hi ${booking.contactName},\n\nYour booking for ${booking.listing.name} has been rescheduled to ${new Date(
          booking.startDate
        ).toDateString()} - ${new Date(booking.endDate).toDateString()}.${
          quote.feeAmount > 0 ? ` A rescheduling fee of Rs ${quote.feeAmount} was charged.` : ''
        } Please note this booking can no longer be cancelled.\n\nBowline Nature Stay`,
        kind: 'booking',
      }).catch(() => {});
    }

    res.json({ booking: serializeGuestBooking(booking) });
  } catch (error) {
    next(error);
  }
};

// ── POST /api/bookings/admin/block ──────────────────────────────────────────
export const blockRoomDates = async (req, res, next) => {
  try {
    const { listingId, startDate, endDate, blockNote = 'Blocked' } = req.body;

    if (!listingId || !startDate || !endDate) {
      res.status(400);
      throw new Error('listingId, startDate and endDate are required');
    }

    const listing = await Listing.findById(listingId);
    if (!listing) { res.status(404); throw new Error('Listing not found'); }

    const block = await Booking.create({
      listing: listing._id,
      user: req.user._id,
      bookingType: 'room',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'blocked',
      paymentStatus: 'paid',
      paymentMethod: 'manual',
      blockNote: String(blockNote).trim() || 'Blocked',
      contactName: 'Admin Block',
      contactEmail: 'admin@bowline.internal',
      guests: 1,
      adultGuests: 1,
      totalPrice: 0,
      source: 'admin',
    });

    res.status(201).json({ block });
  } catch (error) {
    next(error);
  }
};

// ── DELETE /api/bookings/admin/block/:id ────────────────────────────────────
export const unblockRoomDates = async (req, res, next) => {
  try {
    const block = await Booking.findOneAndDelete({ _id: req.params.id, status: 'blocked' });
    if (!block) { res.status(404); throw new Error('Block not found'); }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
