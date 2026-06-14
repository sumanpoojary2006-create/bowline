import crypto from 'crypto';
import dayjs from 'dayjs';
import Booking from '../models/Booking.js';
import { sendText } from '../utils/whatsapp.js';
import { createNotification, notifyAdmins } from '../utils/notifications.js';
import { writeBookingToSheet, writeFullBookingToSheet, isSheetsConfigured } from '../utils/googleSheets.js';
import { sendBookingConfirmationEmail } from '../utils/bookingConfirmationEmail.js';

function syncToSheet(booking) {
  if (!isSheetsConfigured()) return;
  writeBookingToSheet(booking).catch(() => {});
  writeFullBookingToSheet(booking).catch(() => {});
}

export const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    if (!secret || !signature || !req.rawBody) {
      res.sendStatus(400);
      return;
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

    if (expectedSignature !== signature) {
      res.sendStatus(400);
      return;
    }

    res.sendStatus(200);

    const event = req.body;

    if (event.event !== 'payment.captured' && event.event !== 'payment_link.paid') {
      return;
    }

    const payment = event.payload?.payment?.entity;
    const paymentId = payment?.id;
    const paymentLinkId = event.payload?.payment_link?.entity?.id || payment?.notes?.payment_link_id;
    const bookingIdsNote = payment?.notes?.bookingIds;
    const bookingIdNote = payment?.notes?.bookingId;

    let query = null;

    if (bookingIdsNote) {
      const ids = bookingIdsNote.split(',').map((id) => id.trim()).filter(Boolean);
      query = { _id: { $in: ids } };
    } else if (bookingIdNote) {
      query = { _id: bookingIdNote };
    } else if (paymentLinkId) {
      query = { razorpayPaymentLinkId: paymentLinkId };
    } else {
      return;
    }

    const matching = await Booking.find({ ...query, paymentStatus: { $ne: 'paid' } });

    if (!matching.length) {
      return;
    }

    await Booking.updateMany(query, {
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentMethod: 'razorpay',
      razorpayPaymentId: paymentId,
    });

    const updated = await Booking.find(query)
      .populate('listing')
      .populate('user', 'name email phone');

    for (const booking of updated) {
      syncToSheet(booking);

      if (booking.user) {
        createNotification({
          userId: booking.user._id,
          title: 'Booking confirmed',
          message: `Your booking for ${booking.listing.name} has been confirmed.`,
          type: 'booking',
        }).catch(() => {});
      }
    }

    const first = updated[0];

    if (first?.contactPhone) {
      const phone = first.contactPhone.replace(/^\+/, '');
      const grandTotal = updated.reduce((sum, booking) => sum + booking.totalPrice, 0);

      const lines = [`*Payment Received - Booking Confirmed!* ✅`, ``, `*Receipt*`];

      for (const booking of updated) {
        const nights = dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day');
        const dates = `${dayjs(booking.startDate).format('D MMM YYYY')} to ${dayjs(booking.endDate).format('D MMM YYYY')}`;

        lines.push(
          ``,
          `Booking ID: ${booking._id}`,
          `Room: ${booking.listing.name}`,
          `Dates: ${dates} (${nights} night${nights > 1 ? 's' : ''})`,
          `Guests: ${booking.adultGuests} adult${booking.adultGuests > 1 ? 's' : ''}${booking.childGuests ? `, ${booking.childGuests} child${booking.childGuests > 1 ? 'ren' : ''}` : ''}`
        );

        if (booking.pets) {
          lines.push(`Pets: ${booking.pets}`);
        }

        if (booking.vegCount || booking.nonVegCount) {
          lines.push(`Meals: ${booking.vegCount} veg, ${booking.nonVegCount} non-veg`);
        }

        if (booking.pricingBreakdown?.adjustments?.length) {
          lines.push(`Adjustments: ${booking.pricingBreakdown.adjustments.join(', ')}`);
        }

        lines.push(`Amount: Rs ${booking.totalPrice}`);
      }

      lines.push(
        ``,
        `*Total Paid: Rs ${grandTotal}*`,
        `Payment ID: ${paymentId || 'N/A'}`,
        ``,
        `See you soon at Bowline Nature Stay! 🌿`
      );

      sendText(phone, lines.join('\n')).catch(() => {});
    }

    notifyAdmins({
      title: 'Booking confirmed via payment',
      message: `${first?.contactName} paid via WhatsApp for ${updated.map((b) => b.listing.name).join(', ')}.`,
      type: 'booking',
    }).catch(() => {});

    sendBookingConfirmationEmail(updated).catch((error) => {
      console.error('Failed to send booking confirmation email', error);
    });
  } catch (error) {
    next(error);
  }
};
