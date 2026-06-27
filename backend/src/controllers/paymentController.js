import crypto from 'crypto';
import Booking from '../models/Booking.js';
import { createRazorpayOrder, isRazorpayConfigured } from '../utils/razorpay.js';
import { createNotification, notifyAdmins } from '../utils/notifications.js';
import { writeBookingToSheet, writeFullBookingToSheet, isSheetsConfigured } from '../utils/googleSheets.js';
import { sendBookingConfirmationEmail } from '../utils/bookingConfirmationEmail.js';

function syncToSheet(booking) {
  if (!isSheetsConfigured()) return;
  writeBookingToSheet(booking).catch(() => {});
  writeFullBookingToSheet(booking).catch(() => {});
}

// Bookings are paid in two installments: 50% deposit at booking time, the
// remaining 50% online at check-out. The deposit amount is derived from
// totalPrice rather than stored, so it always reflects the booking's current
// price (e.g. after a reschedule).
export const getDepositAmount = (booking) => Math.round(booking.totalPrice / 2);

export const getAmountDue = (booking) => {
  if (booking.paymentStatus === 'paid') return 0;
  if (booking.paymentStatus === 'partially_paid') return booking.totalPrice - getDepositAmount(booking);
  return getDepositAmount(booking);
};

export const createPaymentOrder = async (req, res, next) => {
  try {
    if (!isRazorpayConfigured()) {
      res.status(503);
      throw new Error('Online payments are not configured yet');
    }

    const { bookingIds } = req.body;
    const ids = Array.isArray(bookingIds) ? bookingIds : [bookingIds];

    if (!ids.length || ids.some((id) => !id)) {
      res.status(400);
      throw new Error('bookingIds is required');
    }

    const ownerFilter = req.user ? { user: req.user._id } : { user: null };
    const bookings = await Booking.find({ _id: { $in: ids }, ...ownerFilter });

    if (bookings.length !== ids.length) {
      res.status(404);
      throw new Error('Booking not found');
    }

    const totalAmount = bookings.reduce((sum, booking) => sum + getAmountDue(booking), 0);
    const isFinalPayment = bookings.every((booking) => booking.paymentStatus === 'partially_paid');

    if (totalAmount <= 0) {
      res.status(400);
      throw new Error('This booking has already been paid in full.');
    }

    const order = await createRazorpayOrder({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `bowline_${String(bookings[0]._id)}_${Date.now()}`.slice(0, 40),
      notes: { bookingIds: ids.join(',') },
    });

    await Booking.updateMany({ _id: { $in: ids } }, { razorpayOrderId: order.id });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      description: isFinalPayment ? 'Remaining balance' : 'Booking deposit (50%)',
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400);
      throw new Error('Missing payment verification fields');
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      res.status(400);
      throw new Error('Payment verification failed');
    }

    const ownerFilter = req.user ? { user: req.user._id } : { user: null };
    const bookings = await Booking.find({ razorpayOrderId: razorpay_order_id, ...ownerFilter });

    if (!bookings.length) {
      res.status(404);
      throw new Error('Booking not found for this payment');
    }

    const isFinalPayment = bookings.every((booking) => booking.paymentStatus === 'partially_paid');
    const nextPaymentStatus = isFinalPayment ? 'paid' : 'partially_paid';

    await Booking.updateMany(
      { razorpayOrderId: razorpay_order_id, ...ownerFilter },
      {
        paymentStatus: nextPaymentStatus,
        paymentMethod: 'razorpay',
        razorpayPaymentId: razorpay_payment_id,
        status: 'confirmed',
      }
    );

    const updated = await Booking.find({ razorpayOrderId: razorpay_order_id, ...ownerFilter })
      .populate('listing')
      .populate('user', 'name email phone');

    updated.forEach((booking) => {
      syncToSheet(booking);

      if (booking.user) {
        createNotification({
          userId: booking.user._id,
          title: isFinalPayment ? 'Final payment received' : 'Booking confirmed',
          message: isFinalPayment
            ? `Your remaining balance for ${booking.listing.name} has been received. See you soon!`
            : `Your booking for ${booking.listing.name} has been confirmed with a 50% deposit. The rest is due at check-out.`,
          type: 'booking',
        }).catch(() => {});
      }
    });

    notifyAdmins({
      title: isFinalPayment ? 'Final payment received' : 'Booking confirmed via deposit',
      message: isFinalPayment
        ? `${updated[0].contactName} paid the remaining balance for ${updated[0].listing.name}.`
        : `${updated[0].contactName} paid a 50% deposit and their booking for ${updated[0].listing.name} was auto-confirmed.`,
      type: 'booking',
    }).catch(() => {});

    if (!isFinalPayment) {
      await sendBookingConfirmationEmail(updated).catch((error) => {
        console.error('Failed to send booking confirmation email', error);
      });
    }

    res.json({ bookings: updated });
  } catch (error) {
    next(error);
  }
};
