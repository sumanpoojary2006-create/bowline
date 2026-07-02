import crypto from 'crypto';
import dayjs from 'dayjs';
import Booking from '../models/Booking.js';
import { sendText } from '../utils/whatsapp.js';
import { createNotification, notifyAdmins } from '../utils/notifications.js';
import { writeBookingToSheet, writeFullBookingToSheet, isSheetsConfigured } from '../utils/googleSheets.js';
import { sendBookingConfirmationEmail } from '../utils/bookingConfirmationEmail.js';

function syncToSheet(booking) {
  if (!isSheetsConfigured()) return Promise.resolve();
  return Promise.all([
    writeBookingToSheet(booking).catch(() => {}),
    writeFullBookingToSheet(booking).catch(() => {}),
  ]);
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

    // NOTE: do NOT respond before processing — on Vercel the function can be
    // frozen the moment the response is sent, killing everything after it.
    // Razorpay retries on timeout and the paymentStatus guard below makes
    // retries idempotent, so it's safe to reply at the end.
    const event = req.body;

    // Auto-cancel bookings when payment link expires or payment fails
    if (event.event === 'payment_link.expired' || event.event === 'payment.failed') {
      const paymentLinkId = event.payload?.payment_link?.entity?.id || event.payload?.payment?.entity?.notes?.payment_link_id;
      if (paymentLinkId) {
        const bookings = await Booking.find({ razorpayPaymentLinkId: paymentLinkId, status: 'pending' }).populate('listing');
        for (const booking of bookings) {
          booking.status = 'cancelled';
          booking.paymentStatus = 'failed';
          await booking.save();
          await syncToSheet(booking);
        }
        if (bookings.length) {
          await notifyAdmins({
            title: 'Booking auto-cancelled',
            message: `Payment link expired/failed — ${bookings.map(b => b.listing?.name).join(', ')} auto-cancelled.`,
            type: 'booking',
          }).catch(() => {});
        }
      }
      res.sendStatus(200);
      return;
    }

    if (event.event !== 'payment.captured' && event.event !== 'payment_link.paid') {
      res.sendStatus(200);
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
      res.sendStatus(200);
      return;
    }

    const matching = await Booking.find({ ...query, paymentStatus: { $ne: 'paid' } });

    if (!matching.length) {
      res.sendStatus(200);
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

      // Guest-facing receipt goes out first — everything below is secondary
      await sendText(phone, lines.join('\n')).catch((error) => {
        console.error('[Razorpay webhook] WhatsApp receipt failed:', error?.message);
      });
    }

    await sendBookingConfirmationEmail(updated).catch((error) => {
      console.error('[Razorpay webhook] confirmation email failed:', error?.message);
    });

    for (const booking of updated) {
      await syncToSheet(booking);

      if (booking.user) {
        await createNotification({
          userId: booking.user._id,
          title: 'Booking confirmed',
          message: `Your booking for ${booking.listing.name} has been confirmed.`,
          type: 'booking',
        }).catch(() => {});
      }
    }

    await notifyAdmins({
      title: 'Booking confirmed via payment',
      message: `${first?.contactName} paid via WhatsApp for ${updated.map((b) => b.listing.name).join(', ')}.`,
      type: 'booking',
    }).catch(() => {});

    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
};
