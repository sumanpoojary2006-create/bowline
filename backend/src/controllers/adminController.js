import Booking from '../models/Booking.js';
import Coupon from '../models/Coupon.js';
import Listing from '../models/Listing.js';
import PricingRule from '../models/PricingRule.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import WhatsAppContact from '../models/WhatsAppContact.js';
import { buildDailyReport } from '../utils/guestReport.js';
import { generateDailyReportPdf } from '../utils/pdf.js';
import { sendTomorrowGuestReportEmail } from '../jobs/dailyGuestEmailJob.js';

export const getDashboardOverview = async (req, res, next) => {
  try {
    const [bookings, listings, users, notifications] = await Promise.all([
      Booking.find().populate('listing user', 'name email'),
      Listing.find({ active: true }),
      User.countDocuments({ role: 'user' }),
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10),
    ]);

    const totals = bookings.reduce(
      (acc, booking) => {
        acc.bookings += 1;
        acc.revenue += booking.totalPrice;
        acc.byType[booking.bookingType] += 1;
        return acc;
      },
      {
        bookings: 0,
        revenue: 0,
        byType: {
          room: 0,
          trek: 0,
          camp: 0,
        },
      }
    );

    const upcomingBookings = bookings
      .filter((booking) => booking.status === 'confirmed' && new Date(booking.startDate) >= new Date())
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, 8);

    res.json({
      overview: {
        totalBookings: totals.bookings,
        revenue: totals.revenue,
        upcomingBookings,
        activeListings: listings.length,
        activeUsers: users,
        breakdown: totals.byType,
      },
      listings,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

export const getWhatsAppContacts = async (req, res, next) => {
  try {
    const [totalContacts, contacts] = await Promise.all([
      WhatsAppContact.countDocuments(),
      WhatsAppContact.find().sort({ lastSeenAt: -1 }).limit(200),
    ]);

    res.json({ totalContacts, contacts });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
    const bookingMap = await Booking.aggregate([
      {
        $group: {
          _id: '$user',
          totalBookings: { $sum: 1 },
          totalSpent: {
            $sum: '$totalPrice',
          },
        },
      },
    ]);

    const bookingSummary = new Map(bookingMap.map((entry) => [String(entry._id), entry]));

    res.json({
      users: users.map((user) => ({
        ...user.toObject(),
        bookingSummary: bookingSummary.get(String(user._id)) || {
          totalBookings: 0,
          totalSpent: 0,
        },
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getUserBookingHistory = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.params.id })
      .populate('listing')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
};

export const getPricingRules = async (req, res, next) => {
  try {
    const rules = await PricingRule.find().populate('listing', 'name type').sort({ priority: -1 });
    res.json({ rules });
  } catch (error) {
    next(error);
  }
};

export const createPricingRule = async (req, res, next) => {
  try {
    const rule = await PricingRule.create(req.body);
    res.status(201).json({ rule });
  } catch (error) {
    next(error);
  }
};

export const updatePricingRule = async (req, res, next) => {
  try {
    const rule = await PricingRule.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!rule) {
      res.status(404);
      throw new Error('Pricing rule not found');
    }

    res.json({ rule });
  } catch (error) {
    next(error);
  }
};

export const deletePricingRule = async (req, res, next) => {
  try {
    const rule = await PricingRule.findByIdAndDelete(req.params.id);

    if (!rule) {
      res.status(404);
      throw new Error('Pricing rule not found');
    }

    res.json({ message: 'Pricing rule deleted' });
  } catch (error) {
    next(error);
  }
};

export const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ coupons });
  } catch (error) {
    next(error);
  }
};

export const createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create({
      ...req.body,
      code: String(req.body.code || '').trim().toUpperCase(),
      maxDiscountAmount: req.body.maxDiscountAmount === '' ? null : req.body.maxDiscountAmount,
      startsAt: req.body.startsAt || null,
      endsAt: req.body.endsAt || null,
    });
    res.status(201).json({ coupon });
  } catch (error) {
    next(error);
  }
};

export const updateCoupon = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      code: req.body.code ? String(req.body.code).trim().toUpperCase() : undefined,
      maxDiscountAmount: req.body.maxDiscountAmount === '' ? null : req.body.maxDiscountAmount,
      startsAt: req.body.startsAt || null,
      endsAt: req.body.endsAt || null,
    };

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!coupon) {
      res.status(404);
      throw new Error('Coupon not found');
    }

    res.json({ coupon });
  } catch (error) {
    next(error);
  }
};

export const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);

    if (!coupon) {
      res.status(404);
      throw new Error('Coupon not found');
    }

    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    next(error);
  }
};

export const getDailyGuestReport = async (req, res, next) => {
  try {
    const date = req.query.date || new Date();
    const report = await buildDailyReport(date);

    res.json({ report });
  } catch (error) {
    next(error);
  }
};

export const downloadDailyGuestReportPdf = async (req, res, next) => {
  try {
    const date = req.query.date || new Date();
    const report = await buildDailyReport(date);
    const pdfBuffer = await generateDailyReportPdf(report);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="guest-report-${report.date}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

export const sendDailyGuestReportEmailNow = async (req, res, next) => {
  try {
    await sendTomorrowGuestReportEmail();
    res.json({ message: "Tomorrow's guest report email sent" });
  } catch (error) {
    next(error);
  }
};

// Resolves a "YYYY-MM" query param to a [start, end) date range for that
// calendar month, defaulting to the current month if absent/invalid.
function resolveMonthRange(month) {
  let year, mon;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    [year, mon] = month.split('-').map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    mon = now.getMonth() + 1;
  }

  const rangeStart = new Date(year, mon - 1, 1);
  const rangeEnd = new Date(year, mon, 1);
  const label = `${year}-${String(mon).padStart(2, '0')}`;

  return { rangeStart, rangeEnd, label };
}

// Bookings without a completed payment are abandoned checkouts, not real
// revenue/activity - exclude them from monthly analytics and the export.
const MONTHLY_BOOKINGS_FILTER = {
  $or: [{ status: { $ne: 'pending' } }, { paymentStatus: 'paid' }],
};

export const getMonthlyAnalytics = async (req, res, next) => {
  try {
    const { rangeStart, rangeEnd, label } = resolveMonthRange(req.query.month);

    const bookings = await Booking.find({
      ...MONTHLY_BOOKINGS_FILTER,
      startDate: { $gte: rangeStart, $lt: rangeEnd },
    }).populate('listing', 'name type');

    const confirmed = bookings.filter((b) => b.status === 'confirmed');
    const cancelled = bookings.filter((b) => b.status === 'cancelled');

    const revenue = confirmed.reduce((sum, b) => sum + b.totalPrice, 0);

    const bySource = {};
    for (const booking of confirmed) {
      const key = booking.source || 'website';
      if (!bySource[key]) bySource[key] = { count: 0, revenue: 0 };
      bySource[key].count += 1;
      bySource[key].revenue += booking.totalPrice;
    }

    const byType = {};
    for (const booking of confirmed) {
      const key = booking.bookingType;
      if (!byType[key]) byType[key] = { count: 0, revenue: 0 };
      byType[key].count += 1;
      byType[key].revenue += booking.totalPrice;
    }

    res.json({
      month: label,
      revenue,
      confirmedBookings: confirmed.length,
      cancelledBookings: cancelled.length,
      bySource,
      byType,
    });
  } catch (error) {
    next(error);
  }
};

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const downloadMonthlyBookingsCsv = async (req, res, next) => {
  try {
    const { rangeStart, rangeEnd, label } = resolveMonthRange(req.query.month);

    const bookings = await Booking.find({
      ...MONTHLY_BOOKINGS_FILTER,
      startDate: { $gte: rangeStart, $lt: rangeEnd },
    })
      .populate('listing', 'name type')
      .sort({ startDate: 1 });

    const columns = [
      'Listing',
      'Type',
      'Check-in',
      'Check-out',
      'Guests',
      'Guest name',
      'Email',
      'Phone',
      'Source',
      'Status',
      'Payment status',
      'Total price',
      'Special requests',
    ];

    const rows = bookings.map((booking) => [
      booking.listing?.name || '',
      booking.bookingType,
      booking.startDate.toISOString().slice(0, 10),
      booking.endDate.toISOString().slice(0, 10),
      booking.guests,
      booking.contactName,
      booking.contactEmail,
      booking.contactPhone,
      booking.source || 'website',
      booking.status,
      booking.paymentStatus,
      booking.totalPrice,
      booking.specialRequests,
    ]);

    const csv = [columns, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings-${label}.csv"`,
    });
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
