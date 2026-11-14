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

    doc.font('Helvetica-Bold').fontSize(13).text('Occupancy Summary');
    doc.font('Helvetica').fontSize(11);
    doc.text(`Total Adults: ${report.totals.adults}    Total Children: ${report.totals.children}    Pets: ${report.totals.pets}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(13).text('Guest List');
    doc.moveDown(0.5);

    if (!report.entries.length) {
      doc.font('Helvetica').fontSize(11).text('No guests for this date.');
    } else {
      const colX = { room: 40, guest: 150, dates: 300, guests: 420 };
      const rowHeight = 20;

      const drawHeader = () => {
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Room', colX.room, doc.y, { continued: false });
        doc.text('Guest / Phone', colX.guest, doc.y);
        doc.text('Dates', colX.dates, doc.y);
        doc.text('Pax', colX.guests, doc.y);
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

        doc.moveDown(1.6);

        const paymentLabel =
          entry.paymentStatus === 'paid'
            ? `Payment: 100% paid (Rs ${entry.totalPrice})`
            : `Payment: 50% paid (Rs ${entry.amountPaid} paid, Rs ${entry.amountDue} due)`;
        doc.font('Helvetica').fontSize(8).fillColor('#555');
        doc.text(paymentLabel, colX.room, doc.y, { width: 500 });
        doc.fillColor('#000').fontSize(9);
        doc.moveDown(0.3);

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

export const generateUpcomingCheckinReportPdf = (report) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 34, size: 'A4', layout: 'landscape' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const columns = [
      { key: 'room', label: 'Room', x: 34, width: 105 },
      { key: 'contactName', label: 'Guest name', x: 139, width: 120 },
      { key: 'checkInLabel', label: 'Check-in', x: 259, width: 82 },
      { key: 'checkOutLabel', label: 'Check-out', x: 341, width: 82 },
      { key: 'guestCount', label: 'Guests', x: 423, width: 48 },
      { key: 'contactPhone', label: 'Phone', x: 471, width: 105 },
      { key: 'contactEmail', label: 'Email', x: 576, width: 218 },
    ];

    const drawTitle = () => {
      doc.fillColor('#102013').font('Helvetica-Bold').fontSize(19).text('Bowline Nature Stay');
      doc
        .fillColor('#3f4d40')
        .font('Helvetica')
        .fontSize(11)
        .text(`Upcoming check-ins: ${report.dateLabels.join(' and ')}`);
      doc.moveDown(1);
    };

    const drawHeader = () => {
      const y = doc.y;
      doc.save().roundedRect(34, y - 5, 760, 25, 5).fill('#dff5aa').restore();
      doc.fillColor('#102013').font('Helvetica-Bold').fontSize(8.5);
      columns.forEach((column) => doc.text(column.label, column.x + 4, y + 2, { width: column.width - 8 }));
      doc.y = y + 27;
    };

    const startNewPage = () => {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 34 });
      drawTitle();
    };

    const drawSection = (section) => {
      if (doc.y + 100 > 548) startNewPage();

      const headingY = doc.y;
      doc.save().roundedRect(34, headingY, 760, 29, 6).fill('#eef7d3').restore();
      doc
        .fillColor('#102013')
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(`Check-ins — ${section.dateLabel}`, 43, headingY + 8, { width: 742 });
      doc.y = headingY + 39;
      drawHeader();

      if (!section.entries.length) {
        doc
          .fillColor('#475247')
          .font('Helvetica')
          .fontSize(10)
          .text('No eligible check-ins for this date.', 38, doc.y + 8);
        doc.y += 32;
      }

      section.entries.forEach((entry, index) => {
        const rowHeight = 38;
        if (doc.y + rowHeight + 44 > 548) {
          startNewPage();
          doc
            .fillColor('#102013')
            .font('Helvetica-Bold')
            .fontSize(12)
            .text(`Check-ins — ${section.dateLabel} (continued)`);
          doc.moveDown(0.7);
          drawHeader();
        }

        const y = doc.y;
        if (index % 2 === 1) {
          doc.save().rect(34, y - 3, 760, rowHeight).fill('#f4f7ef').restore();
        }

        doc.fillColor('#1d2a20').font('Helvetica').fontSize(8.5);
        columns.forEach((column) => {
          const value = column.key === 'guestCount' ? String(entry.guestCount) : String(entry[column.key] || '—');
          doc.text(value, column.x + 4, y + 3, {
            width: column.width - 8,
            height: rowHeight - 8,
            ellipsis: true,
          });
        });
        doc.y = y + rowHeight;
        doc.moveTo(34, doc.y - 3).lineTo(794, doc.y - 3).strokeColor('#d9dfd4').stroke();
      });

      if (doc.y + 42 > 548) startNewPage();

      const summaryY = doc.y + 5;
      doc.save().roundedRect(34, summaryY, 760, 34, 6).fill('#102013').restore();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('Summary', 42, summaryY + 11);
      doc
        .font('Helvetica')
        .text(
          `${section.totals.bookings} room booking${section.totals.bookings === 1 ? '' : 's'}  |  ${section.totals.guests} total guest${section.totals.guests === 1 ? '' : 's'}  |  ${section.totals.adults} adults  |  ${section.totals.children} children${section.totals.pets ? `  |  ${section.totals.pets} pets` : ''}`,
          140,
          summaryY + 11,
          { width: 645, align: 'right' }
        );
      doc.y = summaryY + 50;
    };

    drawTitle();
    report.dateSections.forEach(drawSection);

    doc
      .fillColor('#7a8479')
      .font('Helvetica-Oblique')
      .fontSize(7.5)
      .text(`Generated ${dayjs().format('D MMM YYYY, h:mm A')}`, 34, doc.page.height - 55, {
        align: 'right',
        width: 760,
        lineBreak: false,
      });

    doc.end();
  });
