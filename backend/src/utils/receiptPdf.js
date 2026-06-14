import PDFDocument from 'pdfkit';
import dayjs from 'dayjs';

export const generateBookingReceiptPdf = (bookings) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const first = bookings[0];
    const grandTotal = bookings.reduce((sum, booking) => sum + booking.totalPrice, 0);

    doc.font('Helvetica-Bold').fontSize(18).text('Bowline Nature Stay');
    doc.font('Helvetica').fontSize(12).text('Booking Confirmation & Receipt');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555');
    doc.text(`Issued: ${dayjs().format('D MMM YYYY, h:mm A')}`);
    doc.text(`Guest: ${first.contactName}`);
    if (first.contactEmail) doc.text(`Email: ${first.contactEmail}`);
    if (first.contactPhone) doc.text(`Phone: ${first.contactPhone}`);
    doc.fillColor('#000');
    doc.moveDown(1);

    bookings.forEach((booking, index) => {
      const nights = Math.max(dayjs(booking.endDate).diff(dayjs(booking.startDate), 'day'), 1);
      const dates = `${dayjs(booking.startDate).format('D MMM YYYY')} - ${dayjs(booking.endDate).format('D MMM YYYY')}`;

      doc.font('Helvetica-Bold').fontSize(13).text(`${index + 1}. ${booking.listing?.name || 'Booking'}`);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Booking ID: ${booking._id}`);
      doc.text(`Dates: ${dates} (${nights} night${nights > 1 ? 's' : ''})`);

      const guestLine = `${booking.adultGuests} adult${booking.adultGuests > 1 ? 's' : ''}${
        booking.childGuests ? `, ${booking.childGuests} child${booking.childGuests > 1 ? 'ren' : ''}` : ''
      }${booking.pets ? `, ${booking.pets} pet${booking.pets > 1 ? 's' : ''}` : ''}`;
      doc.text(`Guests: ${guestLine}`);

      if (booking.vegCount || booking.nonVegCount) {
        doc.text(`Meals: ${booking.vegCount} veg, ${booking.nonVegCount} non-veg`);
      }

      if (booking.pricingBreakdown?.adjustments?.length) {
        doc.text(`Adjustments: ${booking.pricingBreakdown.adjustments.join(', ')}`);
      }

      if (booking.pricingBreakdown?.coupon?.code) {
        doc.text(
          `Coupon: ${booking.pricingBreakdown.coupon.code} (-Rs ${booking.pricingBreakdown.coupon.discount})`
        );
      }

      if (booking.specialRequests) {
        doc.font('Helvetica-Oblique').text(`Special requests: ${booking.specialRequests}`);
        doc.font('Helvetica');
      }

      doc.font('Helvetica-Bold').text(`Amount: Rs ${booking.totalPrice}`);
      doc.font('Helvetica');
      doc.moveDown(0.8);
    });

    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(13).text(`Total Paid: Rs ${grandTotal}`, { align: 'right' });
    if (first.paymentMethod) {
      doc.font('Helvetica').fontSize(10).fillColor('#555');
      doc.text(`Payment method: ${first.paymentMethod}`, { align: 'right' });
      if (first.razorpayPaymentId) {
        doc.text(`Payment ID: ${first.razorpayPaymentId}`, { align: 'right' });
      }
      doc.fillColor('#000');
    }

    doc.moveDown(1.5);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#888');
    doc.text('Thank you for booking with Bowline Nature Stay. See you soon!');

    doc.end();
  });
