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

    const totalAmount = bookings.reduce((sum, booking) => sum + booking.totalPrice, 0);

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

    await Booking.updateMany(
      { razorpayOrderId: razorpay_order_id, ...ownerFilter },
      {
        paymentStatus: 'paid',
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
          title: 'Booking confirmed',
          message: `Your booking for ${booking.listing.name} has been confirmed.`,
          type: 'booking',
        }).catch(() => {});
      }
    });

    notifyAdmins({
      title: 'Booking confirmed via payment',
      message: `${updated[0].contactName} paid and their booking for ${updated[0].listing.name} was auto-confirmed.`,
      type: 'booking',
    }).catch(() => {});

    sendBookingConfirmationEmail(updated).catch((error) => {
      console.error('Failed to send booking confirmation email', error);
    });

    res.json({ bookings: updated });
  } catch (error) {
    next(error);
  }
};
