import PDFDocument from 'pdfkit';
import dayjs from 'dayjs';

export const generateDailyReportPdf = (report) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text('Bowline Nature Stay', { align: 'left' });
    doc.font('Helvetica').fontSize(12).text(`Guest Report - ${report.dateLabel}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(13).text('Meal Summary');
    doc.font('Helvetica').fontSize(11);
    doc.text(`Veg: ${report.totals.veg}`);
    doc.text(`Non-Veg: ${report.totals.nonVeg}`);
    doc.text(`Total Adults: ${report.totals.adults}    Total Children: ${report.totals.children}    Pets: ${report.totals.pets}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(13).text('Guest List');
    doc.moveDown(0.5);

    if (!report.entries.length) {
      doc.font('Helvetica').fontSize(11).text('No guests for this date.');
    } else {
      const colX = { room: 40, guest: 150, dates: 300, guests: 420, meals: 480 };
      const rowHeight = 20;

      const drawHeader = () => {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Room', colX.room, doc.y, { continued: false });
        doc.text('Guest / Phone', colX.guest, doc.y);
        doc.text('Dates', colX.dates, doc.y);
        doc.text('Pax', colX.guests, doc.y);
        doc.text('Meals (V/NV)', colX.meals, doc.y);
        doc.moveDown(0.8);
        doc.font('Helvetica').fontSize(9);
      };

      let lastY = doc.y;
      drawHeader();

      report.entries.forEach((entry) => {
        if (doc.y > 760) {
          doc.addPage();
          drawHeader();
        }

        const y = doc.y;
        const guests = `${entry.adultGuests} adult${entry.adultGuests > 1 ? 's' : ''}${
          entry.childGuests ? `, ${entry.childGuests} child${entry.childGuests > 1 ? 'ren' : ''}` : ''
        }${entry.pets ? `, ${entry.pets} pet${entry.pets > 1 ? 's' : ''}` : ''}`;

        doc.text(entry.room, colX.room, y, { width: 105 });
        doc.text(`${entry.contactName}\n${entry.contactPhone || ''}`, colX.guest, y, { width: 145 });
        doc.text(
          `${dayjs(entry.checkIn).format('D MMM')} - ${dayjs(entry.checkOut).format('D MMM')}`,
          colX.dates,
          y,
          { width: 110 }
        );
        doc.text(guests, colX.guests, y, { width: 55 });
        doc.text(`${entry.vegCount} / ${entry.nonVegCount}`, colX.meals, y, { width: 70 });

        doc.moveDown(1.6);

        if (entry.specialRequests) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#555');
          doc.text(`Note: ${entry.specialRequests}`, colX.room, doc.y, { width: 500 });
          doc.fillColor('#000').font('Helvetica').fontSize(9);
          doc.moveDown(0.5);
        }

        lastY = doc.y;
        doc.moveTo(40, lastY - 4).lineTo(555, lastY - 4).strokeColor('#ddd').stroke();
      });
    }

    doc.moveDown(1.5);
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888').text(`Generated on ${dayjs().format('D MMM YYYY, h:mm A')}`);

    doc.end();
  });
