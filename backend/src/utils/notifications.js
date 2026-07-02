import dayjs from 'dayjs';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { isEmailConfigured, sendMail } from './email.js';

export const createNotification = async ({ userId, title, message, type = 'system' }) => {
  return Notification.create({
    user: userId,
    title,
    message,
    type,
  });
};

export const formatBookingNotificationDetails = (bookings) => {
  const list = Array.isArray(bookings) ? bookings.filter(Boolean) : [bookings].filter(Boolean);

  const lines = [];

  list.forEach((booking) => {
    const nights = Math.max(dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day'), 1);
    const dates = `${dayjs(booking.startDate).format('D MMM YYYY')} - ${dayjs(booking.endDate).format('D MMM YYYY')}`;
    const guestsLine = `${booking.adultGuests} adult${booking.adultGuests > 1 ? 's' : ''}${
      booking.childGuests ? `, ${booking.childGuests} child${booking.childGuests > 1 ? 'ren' : ''}` : ''
    }`;

    lines.push(
      `Room: ${booking.listing?.name || 'N/A'}`,
      `Dates: ${dates} (${nights} night${nights > 1 ? 's' : ''})`,
      `Guests: ${guestsLine}`,
      `Guest name: ${booking.contactName || 'N/A'}`,
      `Phone: ${booking.contactPhone || 'N/A'}`,
      `Email: ${booking.contactEmail || 'N/A'}`,
      ...(booking.vegCount || booking.nonVegCount
        ? [`Meals: ${booking.vegCount || 0} veg, ${booking.nonVegCount || 0} non-veg`]
        : []),
      `Amount: Rs ${booking.totalPrice}`,
      `Booking ID: ${booking._id}`,
      ''
    );
  });

  if (list.length > 1) {
    const grandTotal = list.reduce((sum, booking) => sum + booking.totalPrice, 0);
    lines.push(`Total: Rs ${grandTotal}`);
  }

  return lines.join('\n').trim();
};

export const notifyAdmins = async ({ title, message, emailBody, type = 'system' }) => {
  const admins = await User.find({ role: 'admin' }).select('_id email');

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin._id,
        title,
        message,
        type,
      })
    )
  );

  if (isEmailConfigured()) {
    const extraRecipients = (process.env.REPORT_EMAIL_RECIPIENTS || '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);

    // Drop placeholder addresses that have no real mailbox — they only bounce.
    // `@bowline.com` is the seed/demo domain (not a domain we own) and
    // `@bowline.internal` is the synthetic address used for admin date-blocks.
    const isDeliverable = (email) => !/@bowline\.(com|internal)$/i.test(email);

    const recipients = [
      ...new Set([...admins.map((admin) => admin.email).filter(Boolean), ...extraRecipients]),
    ].filter(isDeliverable);

    if (recipients.length) {
      try {
        await sendMail({
          to: recipients.join(','),
          subject: `Bowline Admin: ${title}`,
          text: emailBody || message,
        });
      } catch (error) {
        console.error('Failed to send admin notification email', error);
      }
    }
  }
};
