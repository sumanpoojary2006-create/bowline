import cron from 'node-cron';
import dayjs from 'dayjs';
import User from '../models/User.js';
import { buildDailyReport } from '../utils/guestReport.js';
import { generateDailyReportPdf } from '../utils/pdf.js';
import { isEmailConfigured, sendMail } from '../utils/email.js';

export const sendTomorrowGuestReportEmail = async () => {
  if (!isEmailConfigured()) {
    throw new Error('Email is not configured');
  }

  const tomorrow = dayjs().add(1, 'day');
  const report = await buildDailyReport(tomorrow);

  const admins = await User.find({ role: 'admin' }).select('email');
  const extraRecipients = (process.env.REPORT_EMAIL_RECIPIENTS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  const recipients = [...new Set([...admins.map((admin) => admin.email).filter(Boolean), ...extraRecipients])];

  if (!recipients.length) {
    throw new Error('No report email recipients configured');
  }

  const pdfBuffer = await generateDailyReportPdf(report);

  const lines = [
    `Guest report for ${report.dateLabel}`,
    '',
    `Veg: ${report.totals.veg} | Non-Veg: ${report.totals.nonVeg}`,
    `Adults: ${report.totals.adults} | Children: ${report.totals.children} | Pets: ${report.totals.pets}`,
    '',
  ];

  if (!report.entries.length) {
    lines.push('No guests checked in for this date.');
  } else {
    report.entries.forEach((entry) => {
      lines.push(
        `- ${entry.room}: ${entry.contactName} (${entry.contactPhone || 'no phone'}) - ${entry.adultGuests} adult${entry.adultGuests > 1 ? 's' : ''}${
          entry.childGuests ? `, ${entry.childGuests} child${entry.childGuests > 1 ? 'ren' : ''}` : ''
        }, Meals V/NV: ${entry.vegCount}/${entry.nonVegCount}`
      );
    });
  }

  await sendMail({
    to: recipients.join(','),
    subject: `Tomorrow's Guest List - ${report.dateLabel}`,
    text: lines.join('\n'),
    attachments: [
      {
        filename: `guest-report-${report.date}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  console.log(`Sent tomorrow's guest report email to ${recipients.join(', ')}`);
};

export const scheduleDailyGuestEmailJob = () => {
  const schedule = process.env.DAILY_REPORT_CRON || '0 18 * * *';

  cron.schedule(schedule, () => {
    sendTomorrowGuestReportEmail().catch((error) => {
      console.error('Failed to send daily guest report email', error);
    });
  });

  console.log(`Daily guest report email scheduled (${schedule})`);
};
