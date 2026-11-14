import cron from 'node-cron';
import User from '../models/User.js';
import { buildUpcomingCheckinReport } from '../utils/guestReport.js';
import { isEmailConfigured, sendMail } from '../utils/email.js';
import { isWhatsAppConfigured, sendTemplate, sendText } from '../utils/whatsapp.js';

const DEFAULT_REPORT_WHATSAPP_RECIPIENT = '916366004404';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const getEmailRecipients = async () => {
  const admins = await User.find({ role: 'admin' }).select('email');
  const extraRecipients = (process.env.REPORT_EMAIL_RECIPIENTS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  return [
    ...new Set([
      ...admins.map((admin) => admin.email).filter(Boolean),
      ...extraRecipients,
    ]),
  ];
};

const getWhatsAppRecipients = () => {
  const configured =
    process.env.DAILY_REPORT_WHATSAPP_RECIPIENTS ||
    process.env.REPORT_WHATSAPP_RECIPIENTS ||
    DEFAULT_REPORT_WHATSAPP_RECIPIENT;

  return [
    ...new Set(
      configured
        .split(',')
        .map((phone) => phone.replace(/\D/g, ''))
        .filter(Boolean)
    ),
  ];
};

const buildEmailHtml = (report) => {
  const tables = report.dateSections
    .map((section) => {
      const rows = section.entries.length
        ? section.entries
            .map(
              (entry) => `
        <tr>
          <td style="padding:10px">${escapeHtml(entry.room)}</td>
          <td style="padding:10px">${escapeHtml(entry.contactName)}</td>
          <td style="padding:10px">${escapeHtml(entry.checkInLabel)}</td>
          <td style="padding:10px">${escapeHtml(entry.checkOutLabel)}</td>
          <td style="padding:10px;text-align:center">${entry.guestCount}</td>
          <td style="padding:10px">${escapeHtml(entry.contactPhone || '—')}</td>
          <td style="padding:10px">${escapeHtml(entry.contactEmail || '—')}</td>
        </tr>`
            )
            .join('')
        : `<tr><td colspan="7" style="padding:18px 10px;text-align:center;color:#687268">No eligible check-ins for this date.</td></tr>`;

      return `
        <div style="margin:0 0 22px">
          <div style="background:#eef7d3;color:#102013;font-size:17px;font-weight:700;padding:12px 10px;border-left:5px solid #9fc253">Check-ins — ${escapeHtml(section.dateLabel)}</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:800px">
            <thead>
              <tr style="background:#dff5aa;color:#102013">
                <th style="padding:12px 10px;text-align:left">Room</th>
                <th style="padding:12px 10px;text-align:left">Guest name</th>
                <th style="padding:12px 10px;text-align:left">Check-in</th>
                <th style="padding:12px 10px;text-align:left">Check-out</th>
                <th style="padding:12px 10px;text-align:center">Guests</th>
                <th style="padding:12px 10px;text-align:left">Phone</th>
                <th style="padding:12px 10px;text-align:left">Email</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr style="background:#102013;color:#fff;font-weight:700">
                <td colspan="4" style="padding:13px 10px">Summary: ${section.totals.bookings} room booking${section.totals.bookings === 1 ? '' : 's'}</td>
                <td style="padding:13px 10px;text-align:center">${section.totals.guests}</td>
                <td colspan="2" style="padding:13px 10px;text-align:right">${section.totals.adults} adults · ${section.totals.children} children${section.totals.pets ? ` · ${section.totals.pets} pets` : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    })
    .join('');
  const occupancyDateHeaders = report.occupancySections
    .map(
      (section) =>
        `<th style="padding:12px 10px;text-align:center">${escapeHtml(section.dateLabel)}</th>`
    )
    .join('');
  const occupancyTotals = report.occupancySections
    .map(
      (section) =>
        `<td style="padding:14px 10px;text-align:center;font-size:18px;font-weight:700">${section.totalGuests}</td>`
    )
    .join('');
  const occupancyTable = `
    <div style="margin:4px 0 22px">
      <div style="background:#eef7d3;color:#102013;font-size:17px;font-weight:700;padding:12px 10px;border-left:5px solid #9fc253">Daily guest occupancy</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:480px">
        <thead>
          <tr style="background:#dff5aa;color:#102013">
            <th style="padding:12px 10px;text-align:left">Guest summary</th>
            ${occupancyDateHeaders}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:14px 10px;font-weight:700">Total guests staying</td>
            ${occupancyTotals}
          </tr>
        </tbody>
      </table>
    </div>`;

  return `<!doctype html>
  <html>
    <body style="margin:0;background:#f4f7ef;font-family:Arial,sans-serif;color:#172119">
      <div style="max-width:1040px;margin:0 auto;padding:24px">
        <div style="background:#102013;border-radius:18px 18px 0 0;padding:22px 24px;color:#fff">
          <div style="font-size:22px;font-weight:700">Bowline Nature Stay</div>
          <div style="margin-top:6px;color:#dff5aa">Upcoming check-ins: ${report.dateLabels.map(escapeHtml).join(' and ')}</div>
        </div>
        <div style="overflow-x:auto;background:#fff;border:1px solid #dbe2d7;border-top:0;padding:18px 14px 1px">
          ${tables}
          ${occupancyTable}
        </div>
        <p style="margin:12px 4px 0;color:#687268;font-size:12px">Only confirmed bookings with 50% or 100% payment recorded are included.</p>
      </div>
    </body>
  </html>`;
};

const buildTextReport = (report) => {
  const lines = [
    `Bowline upcoming check-ins: ${report.dateLabels.join(' and ')}`,
  ];

  report.dateSections.forEach((section) => {
    lines.push('', `Check-ins — ${section.dateLabel}`, 'Room | Guest | Check-in | Check-out | Guests | Phone | Email');
    if (section.entries.length) {
      lines.push(
        ...section.entries.map(
          (entry) =>
            `${entry.room} | ${entry.contactName} | ${entry.checkInLabel} | ${entry.checkOutLabel} | ${entry.guestCount} | ${entry.contactPhone || '—'} | ${entry.contactEmail || '—'}`
        )
      );
    } else {
      lines.push('No eligible check-ins for this date.');
    }
    lines.push(
      `Summary: ${section.totals.bookings} room booking${section.totals.bookings === 1 ? '' : 's'} | ${section.totals.guests} total guest${section.totals.guests === 1 ? '' : 's'} | ${section.totals.adults} adults | ${section.totals.children} children${section.totals.pets ? ` | ${section.totals.pets} pets` : ''}`
    );
  });

  lines.push(
    '',
    'Daily guest occupancy',
    `Guest summary | ${report.occupancySections.map((section) => section.dateLabel).join(' | ')}`,
    `Total guests staying | ${report.occupancySections.map((section) => section.totalGuests).join(' | ')}`
  );

  return lines.join('\n');
};

const buildWhatsAppDetails = (report) => {
  if (!report.entries.length) {
    return 'No confirmed 50% or fully paid check-ins were found for these dates.';
  }

  return report.entries
    .map(
      (entry, index) =>
        `${index + 1}. *${entry.room}*\n${entry.contactName}\n${entry.checkInLabel} → ${entry.checkOutLabel}\nGuests: ${entry.guestCount}\n${entry.contactPhone || 'No phone'}\n${entry.contactEmail || 'No email'}`
    )
    .join('\n\n');
};

const sendWhatsAppReport = async (report) => {
  if (!isWhatsAppConfigured()) {
    return { sent: 0, skipped: 'WhatsApp is not configured' };
  }

  const recipients = getWhatsAppRecipients();
  if (!recipients.length) {
    return { sent: 0, skipped: 'No WhatsApp report recipients configured' };
  }

  const details = buildWhatsAppDetails(report);
  const summary = `${report.totals.bookings} room booking${report.totals.bookings === 1 ? '' : 's'} · ${report.totals.guests} guests`;
  const templateName = process.env.DAILY_REPORT_WHATSAPP_TEMPLATE?.trim();
  const templateLanguage = process.env.DAILY_REPORT_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en';

  const results = await Promise.allSettled(
    recipients.map((to) =>
      templateName
        ? sendTemplate(to, {
            name: templateName,
            language: templateLanguage,
            bodyParameters: [report.dateLabels.join(' and '), details, summary],
          })
        : sendText(
            to,
            `*Bowline — Upcoming check-ins*\n${report.dateLabels.join(' and ')}\n\n${details}\n\n*Summary:* ${summary}\nOnly confirmed 50% or fully paid bookings are included.`
          )
    )
  );

  const rejected = results.filter((result) => result.status === 'rejected');
  rejected.forEach((result) => console.error('Failed to send daily WhatsApp report', result.reason));

  return { sent: results.length - rejected.length, failed: rejected.length };
};

export const sendUpcomingCheckinReport = async ({
  now = new Date(),
  sendEmpty = false,
  sendWhatsApp = true,
} = {}) => {
  const report = await buildUpcomingCheckinReport(now);

  if (!report.entries.length && !sendEmpty) {
    return { skipped: true, reason: 'No eligible upcoming check-ins', report };
  }

  if (!isEmailConfigured()) {
    throw new Error('Email is not configured');
  }

  const recipients = await getEmailRecipients();
  if (!recipients.length) {
    throw new Error('No report email recipients configured');
  }

  const text = buildTextReport(report);

  await sendMail({
    to: recipients.join(','),
    subject: `Upcoming Check-ins - ${report.dateLabels.join(' & ')}`,
    text,
    html: buildEmailHtml(report),
  });

  const whatsApp = sendWhatsApp
    ? await sendWhatsAppReport(report)
    : { sent: 0, skipped: 'Disabled for this delivery' };
  console.log(`Sent upcoming check-in report email to ${recipients.join(', ')}`);

  return {
    skipped: false,
    reportKey: report.reportKey,
    bookings: report.totals.bookings,
    guests: report.totals.guests,
    emailRecipients: recipients.length,
    whatsApp,
  };
};

// Preserve the old export used by the admin "send now" endpoint.
export const sendTomorrowGuestReportEmail = () => sendUpcomingCheckinReport();

export const scheduleDailyGuestEmailJob = () => {
  // node-cron uses the process timezone. Vercel production uses the platform
  // cron in vercel.json; this is retained for long-running/local servers.
  const schedule = process.env.DAILY_REPORT_CRON || '30 20 * * *';

  cron.schedule(
    schedule,
    () => {
      sendUpcomingCheckinReport().catch((error) => {
        console.error('Failed to send daily upcoming check-in report', error);
      });
    },
    { timezone: 'UTC' }
  );

  console.log(`Daily upcoming check-in report scheduled (${schedule} UTC)`);
};
