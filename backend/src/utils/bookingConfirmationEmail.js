import dayjs from 'dayjs';
import { isEmailConfigured, sendMail } from './email.js';
import { generateBookingReceiptPdf } from './receiptPdf.js';

const isRealEmail = (email) => Boolean(email) && !/@bowline\.guest$/i.test(email);

export const sendBookingConfirmationEmail = async (bookings) => {
  const list = Array.isArray(bookings) ? bookings.filter(Boolean) : [bookings].filter(Boolean);

  if (!list.length) return;

  const first = list[0];

  if (!isRealEmail(first.contactEmail) || !isEmailConfigured('booking')) {
    return;
  }

  const grandTotal = list.reduce((sum, booking) => sum + booking.totalPrice, 0);

  const lines = [`Hi ${first.contactName},`, '', 'Your booking with Bowline Nature Stay is confirmed!', ''];

  list.forEach((booking) => {
    const nights = Math.max(dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day'), 1);
    const dates = `${dayjs(booking.startDate).format('D MMM YYYY')} - ${dayjs(booking.endDate).format('D MMM YYYY')}`;

    lines.push(
      `${booking.listing?.name || 'Booking'}`,
      `Booking ID: ${booking._id}`,
      `Dates: ${dates} (${nights} night${nights > 1 ? 's' : ''})`,
      `Amount: Rs ${booking.totalPrice}`,
      ''
    );
  });

  lines.push(`Total Paid: Rs ${grandTotal}`, '', 'A detailed receipt is attached as a PDF.', '', 'See you soon!', 'Bowline Nature Stay');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #4d7c0f;">Booking Confirmed</h2>
      <p>Hi ${first.contactName},</p>
      <p>Your booking with <strong>Bowline Nature Stay</strong> is confirmed. Here's a summary:</p>
      ${list
        .map((booking) => {
          const nights = Math.max(dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day'), 1);
          const dates = `${dayjs(booking.startDate).format('D MMM YYYY')} - ${dayjs(booking.endDate).format('D MMM YYYY')}`;
          return `
            <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
              <p style="margin: 0; font-weight: bold; font-size: 16px;">${booking.listing?.name || 'Booking'}</p>
              <p style="margin: 4px 0; color: #555; font-size: 13px;">Booking ID: ${booking._id}</p>
              <p style="margin: 4px 0;">${dates} (${nights} night${nights > 1 ? 's' : ''})</p>
              <p style="margin: 4px 0; font-weight: bold;">Amount: Rs ${booking.totalPrice}</p>
            </div>
          `;
        })
        .join('')}
      <p style="font-size: 18px; font-weight: bold;">Total Paid: Rs ${grandTotal}</p>
      <p>A detailed receipt is attached to this email as a PDF.</p>
      <p>See you soon at Bowline Nature Stay! 🌿</p>
    </div>
  `;

  const pdfBuffer = await generateBookingReceiptPdf(list);

  await sendMail({
    to: first.contactEmail,
    subject: `Booking Confirmed - ${first.listing?.name || 'Bowline Nature Stay'}`,
    text: lines.join('\n'),
    html,
    attachments: [
      {
        filename: `bowline-receipt-${first._id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
    kind: 'booking',
  });
};
