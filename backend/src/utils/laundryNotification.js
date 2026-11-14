const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatSubmittedAt = (value) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'long',
  timeStyle: 'short',
}).format(value ? new Date(value) : new Date());

export function buildLaundryAdminNotification(record) {
  const rows = Array.isArray(record?.rows) ? record.rows : [];
  const totals = rows.reduce((summary, row) => ({
    sent: summary.sent + Number(row.sent || 0),
    received: summary.received + Number(row.received || 0),
    inHouse: summary.inHouse + Number(row.summary || 0),
  }), { sent: 0, received: 0, inHouse: 0 });
  const staffName = String(record?.staffName || 'Staff member').replace(/[\r\n]+/g, ' ').trim();
  const submittedAt = formatSubmittedAt(record?.createdAt);

  const textRows = rows.map((row) => [
    row.name || 'Laundry item',
    `Sent: ${Number(row.sent || 0)}`,
    `Received: ${Number(row.received || 0)}`,
    `In-house: ${Number(row.summary || 0)}`,
  ].join(' | '));

  const htmlRows = rows.map((row) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #dfe8dd;">${escapeHtml(row.name || 'Laundry item')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #dfe8dd;text-align:center;">${Number(row.sent || 0)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #dfe8dd;text-align:center;">${Number(row.received || 0)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #dfe8dd;text-align:center;font-weight:700;">${Number(row.summary || 0)}</td>
    </tr>`).join('');

  return {
    title: 'Laundry report submitted',
    message: `${staffName} submitted the laundry report. Sent: ${totals.sent}, received: ${totals.received}, in-house: ${totals.inHouse}.`,
    emailSubject: `Laundry report submitted - ${staffName} - ${record?.date || 'Today'}`,
    emailBody: [
      'Bowline Nature Stay - Laundry report',
      `Submitted by: ${staffName}`,
      `Submitted at: ${submittedAt}`,
      '',
      ...textRows,
      '',
      `Summary | Sent: ${totals.sent} | Received: ${totals.received} | In-house: ${totals.inHouse}`,
    ].join('\n'),
    emailHtml: `
      <div style="font-family:Arial,sans-serif;color:#18352d;max-width:760px;margin:0 auto;">
        <div style="background:#0d2b20;color:#fff;padding:24px;border-radius:14px 14px 0 0;">
          <h1 style="font-size:24px;margin:0 0 8px;">Laundry report submitted</h1>
          <p style="margin:0;color:#d9f99d;">Bowline Nature Stay</p>
        </div>
        <div style="border:1px solid #dfe8dd;border-top:0;padding:22px;border-radius:0 0 14px 14px;">
          <p style="margin:0 0 5px;"><strong>Submitted by:</strong> ${escapeHtml(staffName)}</p>
          <p style="margin:0 0 20px;color:#5d6e67;"><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#e5f6b2;">
                  <th style="padding:11px 12px;text-align:left;">Item</th>
                  <th style="padding:11px 12px;">Sent ↑</th>
                  <th style="padding:11px 12px;">Received ↓</th>
                  <th style="padding:11px 12px;">In-house 🏠</th>
                </tr>
              </thead>
              <tbody>${htmlRows}</tbody>
              <tfoot>
                <tr style="background:#0d2b20;color:#fff;">
                  <th style="padding:12px;text-align:left;">Total</th>
                  <th style="padding:12px;">${totals.sent}</th>
                  <th style="padding:12px;">${totals.received}</th>
                  <th style="padding:12px;">${totals.inHouse}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>`,
    totals,
  };
}
