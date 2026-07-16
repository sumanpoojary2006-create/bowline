import PDFDocument from 'pdfkit';
import dayjs from 'dayjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getAmountPaid, getAmountDue } from '../controllers/paymentController.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, '../../../frontend/src/assets/bowline-logo.png');

const GREEN = '#2d5a1b';
const GREEN_LIGHT = '#4a7c2f';
const PAGE_WIDTH = 595;
const MARGIN = 45;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function drawHeader(doc) {
  const headerTop = 34;
  const logoWidth = 118;

  // Keep the receipt header print-friendly: small logo, no full-width banner.
  try {
    doc.image(LOGO_PATH, MARGIN, headerTop, { width: logoWidth });
  } catch {
    doc.font('Helvetica-Bold').fontSize(16).fillColor(GREEN)
      .text('Bowline Nature Stay', MARGIN, headerTop);
  }

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#222')
    .text('BOOKING RECEIPT', MARGIN + 150, headerTop + 2, { align: 'right', width: CONTENT_WIDTH - 150 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#666')
    .text('Bowline Nature Stay', MARGIN + 150, headerTop + 24, { align: 'right', width: CONTENT_WIDTH - 150 })
    .text('Devaramane, Mudigere, Chikkamagaluru', MARGIN + 150, headerTop + 36, { align: 'right', width: CONTENT_WIDTH - 150 })
    .text('bowlinestays@gmail.com | +91 74116 60024 | www.bowlinestays.com', MARGIN + 150, headerTop + 48, {
      align: 'right',
      width: CONTENT_WIDTH - 150,
    });

  doc.moveTo(MARGIN, 96).lineTo(MARGIN + CONTENT_WIDTH, 96).strokeColor('#d9e8d0').lineWidth(1).stroke();
}

function drawSectionLabel(doc, label, y) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN)
    .text(label.toUpperCase(), MARGIN, y, { width: CONTENT_WIDTH });
  doc.moveTo(MARGIN, y + 14).lineTo(MARGIN + CONTENT_WIDTH, y + 14).strokeColor('#d9e8d0').lineWidth(0.8).stroke();
  return y + 20;
}

function row(doc, label, value, y, { bold = false, large = false, color = '#222' } = {}) {
  const fontSize = large ? 13 : 10;
  doc.font('Helvetica').fontSize(fontSize).fillColor('#666').text(label, MARGIN + 10, y, { width: 160 });
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(color)
    .text(value, MARGIN + 175, y, { width: CONTENT_WIDTH - 185, align: 'left' });
  return y + (large ? 20 : 16);
}

export const generateBookingReceiptPdf = (bookings) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const first = bookings[0];
    const grandTotal = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
    const totalPaid = bookings.reduce((sum, b) => sum + getAmountPaid(b), 0);
    const totalDue = bookings.reduce((sum, b) => sum + getAmountDue(b), 0);
    const isFullyPaid = totalDue === 0;

    drawHeader(doc);
    let y = 112;

    doc.font('Helvetica').fontSize(9).fillColor('#888')
      .text(`Receipt issued: ${dayjs().format('D MMM YYYY [at] h:mm A')}`, MARGIN, y, { align: 'right', width: CONTENT_WIDTH })
      .text(`Booking ID: ${first._id}`, MARGIN, y + 12, { align: 'right', width: CONTENT_WIDTH });
    y += 34;

    y = drawSectionLabel(doc, 'Guest Details', y);
    y += 6;
    y = row(doc, 'Name', first.contactName, y);
    if (first.contactEmail) y = row(doc, 'Email', first.contactEmail, y);
    if (first.contactPhone) y = row(doc, 'Phone', first.contactPhone, y);
    y += 12;

    y = drawSectionLabel(doc, `Booking${bookings.length > 1 ? 's' : ''} Summary`, y);

    bookings.forEach((booking, idx) => {
      const nights = Math.max(dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day'), 1);
      const checkIn = dayjs(booking.startDate).format('D MMM YYYY');
      const checkOut = dayjs(booking.endDate).format('D MMM YYYY');
      const guestParts = [];
      if (booking.adultGuests) guestParts.push(`${booking.adultGuests} adult${booking.adultGuests > 1 ? 's' : ''}`);
      if (booking.childGuests) guestParts.push(`${booking.childGuests} child${booking.childGuests > 1 ? 'ren' : ''}`);
      if (booking.pets) guestParts.push(`${booking.pets} pet${booking.pets > 1 ? 's' : ''}`);

      if (idx > 0) {
        doc.moveTo(MARGIN, y + 4).lineTo(MARGIN + CONTENT_WIDTH, y + 4).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
        y += 12;
      }

      y += 8;
      doc.font('Helvetica-Bold').fontSize(12).fillColor(GREEN_LIGHT)
        .text(booking.listing?.name || 'Booking', MARGIN + 10, y);
      y += 18;
      y = row(doc, 'Check-in', checkIn, y);
      y = row(doc, 'Check-out', `${checkOut} (${nights} night${nights > 1 ? 's' : ''})`, y);
      if (guestParts.length) y = row(doc, 'Guests', guestParts.join(', '), y);
      if (booking.vegCount != null || booking.nonVegCount != null) {
        y = row(doc, 'Meals', `${booking.vegCount ?? 0} veg · ${booking.nonVegCount ?? 0} non-veg`, y);
      }
      if (booking.specialRequests) {
        y = row(doc, 'Special requests', booking.specialRequests, y);
      }
      if (booking.pricingBreakdown?.coupon?.code) {
        y = row(doc, 'Coupon', `${booking.pricingBreakdown.coupon.code}  -Rs.${booking.pricingBreakdown.coupon.discount}`, y, { color: '#c0392b' });
      }
      y = row(doc, 'Room total', `Rs. ${booking.totalPrice.toLocaleString('en-IN')}`, y, { bold: true });
      y += 6;
    });

    y += 4;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_WIDTH, y).strokeColor('#c8e0b8').lineWidth(1).stroke();
    y += 12;

    doc.rect(MARGIN, y, CONTENT_WIDTH, 48).strokeColor('#d9e8d0').lineWidth(0.8).stroke();
    doc.font('Helvetica').fontSize(10).fillColor('#555')
      .text(isFullyPaid ? 'TOTAL PAID' : 'DEPOSIT PAID', MARGIN + 12, y + 10);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(GREEN)
      .text(`Rs. ${totalPaid.toLocaleString('en-IN')}`, MARGIN + 12, y + 22);
    doc.font('Helvetica').fontSize(9).fillColor('#777')
      .text(`Payment via ${first.paymentMethod === 'razorpay' ? 'Razorpay' : first.paymentMethod || 'Online'}`, PAGE_WIDTH - MARGIN - 180, y + 10, { align: 'right', width: 180 });
    if (first.razorpayPaymentId) {
      doc.font('Helvetica').fontSize(8).fillColor('#999')
        .text(`Txn: ${first.razorpayPaymentId}`, PAGE_WIDTH - MARGIN - 180, y + 26, { align: 'right', width: 180 });
    }
    y += 62;

    if (!isFullyPaid && totalDue > 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#555')
        .text('BALANCE DUE AT CHECK-OUT', MARGIN + 12, y);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#c0392b')
        .text(`Rs. ${totalDue.toLocaleString('en-IN')}`, MARGIN + 12, y + 14);
      y += 30;
    }

    y = drawSectionLabel(doc, 'Important Information', y);
    y += 8;
    const policies = [
      'Check-in: 1:00 PM  ·  Check-out: 10:00 AM',
      'Breakfast is complimentary. Lunch & dinner are Rs.350 per person per meal.',
      'Pets are welcome with prior notice. Pet fee: Rs.400 per stay.',
      'For cancellations or changes please contact us at bowlinestays@gmail.com.',
    ];
    policies.forEach((line) => {
      doc.font('Helvetica').fontSize(9).fillColor('#555').text(`• ${line}`, MARGIN + 10, y, { width: CONTENT_WIDTH - 20 });
      y += 14;
    });

    const footerY = 800;
    doc.moveTo(MARGIN, footerY).lineTo(MARGIN + CONTENT_WIDTH, footerY).strokeColor('#d9e8d0').lineWidth(0.8).stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#777')
      .text('Thank you for choosing Bowline Nature Stay.', MARGIN, footerY + 10, { align: 'center', width: CONTENT_WIDTH })
      .text('bowlinestays@gmail.com | +91 74116 60024 | www.bowlinestays.com', MARGIN, footerY + 24, {
        align: 'center',
        width: CONTENT_WIDTH,
      });

    doc.end();
  });
