import dayjs from 'dayjs';
import { isEmailConfigured, sendMail } from './email.js';

const isRealEmail = (email) => Boolean(email) && !/@bowline\.guest$/i.test(email);

// Sent the moment a booking request is submitted but before any payment has
// been made — distinct from sendBookingConfirmationEmail, which only fires
// once a deposit or full payment actually clears. Guests who abandon
// checkout still hear back from us instead of getting silence.
export const sendBookingInquiryEmail = async (bookings) => {
  const list = Array.isArray(bookings) ? bookings.filter(Boolean) : [bookings].filter(Boolean);

  if (!list.length) return;

  const first = list[0];

  if (!isRealEmail(first.contactEmail) || !isEmailConfigured('booking')) {
    return;
  }

  const grandTotal = list.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);

  const lines = [
    `Hi ${first.contactName},`,
    '',
    "We've received your booking request with Bowline Nature Stay. This is not confirmed yet — it's held until payment is completed.",
    '',
  ];

  list.forEach((booking) => {
    const nights = Math.max(dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day'), 1);
    const dates = `${dayjs(booking.startDate).format('D MMM YYYY')} - ${dayjs(booking.endDate).format('D MMM YYYY')}`;

    lines.push(
      `${booking.listing?.name || 'Booking'}`,
      `Booking ID: ${booking._id}`,
      `Dates: ${dates} (${nights} night${nights > 1 ? 's' : ''})`,
      `Amount Due: Rs ${booking.totalPrice}`,
      ''
    );
  });

  lines.push(
    `Total: Rs ${grandTotal}`,
    '',
    'Complete payment to secure your dates. If you did not mean to submit this request, you can ignore this email.',
    '',
    'Bowline Nature Stay'
  );

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #b45309;">Booking Inquiry Received</h2>
      <p>Hi ${first.contactName},</p>
      <p>We've received your booking request with <strong>Bowline Nature Stay</strong>. This is <strong>not confirmed yet</strong> — it's held until payment is completed.</p>
      ${list
        .map((booking) => {
          const nights = Math.max(dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day'), 1);
          const dates = `${dayjs(booking.startDate).format('D MMM YYYY')} - ${dayjs(booking.endDate).format('D MMM YYYY')}`;
          return `
            <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
              <p style="margin: 0; font-weight: bold; font-size: 16px;">${booking.listing?.name || 'Booking'}</p>
              <p style="margin: 4px 0; color: #555; font-size: 13px;">Booking ID: ${booking._id}</p>
              <p style="margin: 4px 0;">${dates} (${nights} night${nights > 1 ? 's' : ''})</p>
              <p style="margin: 4px 0; font-weight: bold;">Amount Due: Rs ${booking.totalPrice}</p>
            </div>
          `;
        })
        .join('')}
      <p style="font-size: 18px; font-weight: bold;">Total: Rs ${grandTotal}</p>
      <p>Complete payment to secure your dates. If you did not mean to submit this request, you can ignore this email.</p>
    </div>
  `;

  await sendMail({
    to: first.contactEmail,
    subject: `Inquiry - ${first.listing?.name || 'Bowline Nature Stay'}`,
    text: lines.join('\n'),
    html,
    kind: 'booking',
  });
};
