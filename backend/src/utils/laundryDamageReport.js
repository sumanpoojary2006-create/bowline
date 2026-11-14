const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export function getPreviousMonthWindow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric',
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const offset = 330 * 60 * 1000;
  const end = new Date(Date.UTC(parts.year, parts.month - 1, 1) - offset);
  const start = new Date(Date.UTC(parts.year, parts.month - 2, 1) - offset);
  const label = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric',
  }).format(new Date(start.getTime() + offset));
  const reportMonth = new Date(Date.UTC(parts.year, parts.month - 2, 15));
  const key = `${reportMonth.getUTCFullYear()}-${String(reportMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  return { start, end, label, key };
}

export function buildLaundryDamageReport(adjustments, label) {
  const entries = Array.isArray(adjustments) ? adjustments : [];
  const totals = entries.reduce((summary, entry) => {
    summary[entry.reason] += Number(entry.quantity || 0);
    summary.total += Number(entry.quantity || 0);
    return summary;
  }, { lost: 0, damaged: 0, total: 0 });
  const textRows = entries.length
    ? entries.map((entry) => `${entry.itemName} | ${entry.reason === 'lost' ? 'Lost' : 'Damaged'} | ${entry.quantity} | ${entry.previousStock} → ${entry.newStock} | ${entry.adminName}`).join('\n')
    : 'No lost or damaged laundry stock was recorded.';
  const htmlRows = entries.length
    ? entries.map((entry) => `<tr>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;">${escapeHtml(entry.itemName)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;text-transform:capitalize;">${escapeHtml(entry.reason)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;text-align:center;font-weight:700;">${Number(entry.quantity || 0)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;text-align:center;">${Number(entry.previousStock)} → ${Number(entry.newStock)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;">${escapeHtml(entry.adminName)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="padding:22px;text-align:center;color:#687268;">No lost or damaged laundry stock was recorded.</td></tr>';

  return {
    totals,
    title: 'Monthly laundry loss & damage report',
    message: `${label}: ${totals.lost} lost and ${totals.damaged} damaged pieces recorded.`,
    emailSubject: `Laundry Loss & Damage Report - ${label}`,
    emailBody: `Bowline Nature Stay - Laundry Loss & Damage Report\n${label}\n\nItem | Reason | Quantity | Stock change | Recorded by\n${textRows}\n\nLost: ${totals.lost}\nDamaged: ${totals.damaged}\nTotal reductions: ${totals.total}`,
    emailHtml: `<div style="font-family:Arial,sans-serif;color:#17362d;max-width:820px;margin:0 auto;">
      <div style="background:#102c22;color:#fff;padding:24px;border-radius:14px 14px 0 0;">
        <h1 style="margin:0;font-size:24px;">Laundry Loss &amp; Damage Report</h1>
        <p style="margin:7px 0 0;color:#dff5aa;">${escapeHtml(label)}</p>
      </div>
      <div style="border:1px solid #dce5d9;border-top:0;padding:20px;border-radius:0 0 14px 14px;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:680px;">
          <thead><tr style="background:#dff5aa;color:#102013;">
            <th style="padding:11px;text-align:left;">Item</th><th style="padding:11px;text-align:left;">Reason</th><th style="padding:11px;">Quantity</th><th style="padding:11px;">Stock change</th><th style="padding:11px;text-align:left;">Recorded by</th>
          </tr></thead>
          <tbody>${htmlRows}</tbody>
          <tfoot><tr style="background:#102c22;color:#fff;font-weight:700;">
            <td colspan="2" style="padding:12px;">Monthly summary</td><td colspan="3" style="padding:12px;text-align:right;">Lost: ${totals.lost} &nbsp;·&nbsp; Damaged: ${totals.damaged} &nbsp;·&nbsp; Total: ${totals.total}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`,
  };
}
