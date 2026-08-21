import dayjs from 'dayjs';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { isEmailConfigured, sendMail } from './email.js';
import { getAmountPaid, getAmountDue } from './bookingAmounts.js';

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
      `Amount: Rs ${booking.totalPrice}`,
      `Paid: Rs ${getAmountPaid(booking)}`,
      `Pending: Rs ${getAmountDue(booking)}`,
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

// HTML twin of formatBookingNotificationDetails, color-coded so the admin can
// tell paid vs. still-owed at a glance without reading numbers carefully.
export const formatBookingNotificationDetailsHtml = (bookings) => {
  const list = Array.isArray(bookings) ? bookings.filter(Boolean) : [bookings].filter(Boolean);

  const cards = list
    .map((booking) => {
      const nights = Math.max(dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day'), 1);
      const dates = `${dayjs(booking.startDate).format('D MMM YYYY')} - ${dayjs(booking.endDate).format('D MMM YYYY')}`;
      const guestsLine = `${booking.adultGuests} adult${booking.adultGuests > 1 ? 's' : ''}${
        booking.childGuests ? `, ${booking.childGuests} child${booking.childGuests > 1 ? 'ren' : ''}` : ''
      }`;
      const paid = getAmountPaid(booking);
      const due = getAmountDue(booking);

      return `
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
          <p style="margin: 0; font-weight: bold; font-size: 16px;">${booking.listing?.name || 'N/A'}</p>
          <p style="margin: 6px 0 0; color: #444; font-size: 13px;">${dates} (${nights} night${nights > 1 ? 's' : ''})</p>
          <p style="margin: 4px 0 0; color: #444; font-size: 13px;">${guestsLine}</p>
          <p style="margin: 4px 0 0; color: #444; font-size: 13px;">${booking.contactName || 'N/A'} · ${booking.contactPhone || 'N/A'} · ${booking.contactEmail || 'N/A'}</p>
          <p style="margin: 10px 0 0; font-size: 13px;">Total: Rs ${booking.totalPrice}</p>
          <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: #15803d;">Paid: Rs ${paid}</p>
          <p style="margin: 4px 0 0; font-size: 14px; font-weight: bold; color: ${due > 0 ? '#dc2626' : '#15803d'};">
            ${due > 0 ? `Pending: Rs ${due}` : 'Fully Paid ✓'}
          </p>
          <p style="margin: 8px 0 0; color: #888; font-size: 12px;">Booking ID: ${booking._id}</p>
        </div>
      `;
    })
    .join('');

  const totalPaid = list.reduce((sum, booking) => sum + getAmountPaid(booking), 0);
  const totalDue = list.reduce((sum, booking) => sum + getAmountDue(booking), 0);

  const summary =
    list.length > 1
      ? `
        <div style="margin-top: 4px; font-size: 15px;">
          <span style="font-weight: bold; color: #15803d;">Total Paid: Rs ${totalPaid}</span>
          &nbsp;&nbsp;
          <span style="font-weight: bold; color: ${totalDue > 0 ? '#dc2626' : '#15803d'};">
            ${totalDue > 0 ? `Total Pending: Rs ${totalDue}` : 'Fully Paid ✓'}
          </span>
        </div>
      `
      : '';

  return `<div style="font-family: Arial, sans-serif; color: #1a1a1a;">${cards}${summary}</div>`;
};

export const formatAdminBookingEmailSubject = (bookings, status) => {
  const list = Array.isArray(bookings) ? bookings.filter(Boolean) : [bookings].filter(Boolean);
  const guestName = list[0]?.contactName || 'Guest';

  if (status === 'full') return `Booking Confirmed (100% paid) - ${guestName}`;
  if (status === 'partial') return `Booking Confirmed (50% paid) - ${guestName}`;
  return `Booking Inquiry - ${guestName} (NO payment done)`;
};

export const notifyAdmins = async ({ title, message, emailBody, emailHtml, emailSubject, type = 'system' }) => {
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
          subject: emailSubject || `Bowline Admin: ${title}`,
          text: emailBody || message,
          html: emailHtml,
        });
      } catch (error) {
        console.error('Failed to send admin notification email', error);
      }
    }
  }
};
