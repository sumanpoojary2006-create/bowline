const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatRupees = (amount) => Number(amount || 0).toLocaleString('en-IN');

// `slips` is an array of { employee, summary }, summary being whatever
// computeMonthlySalary() returned for that employee for the report month.
export function buildSalarySlipReport(slips, label) {
  const entries = Array.isArray(slips) ? slips : [];
  const totalSalary = entries.reduce((sum, { summary }) => sum + (summary.calculatedSalary || 0), 0);

  const textRows = entries.length
    ? entries.map(({ employee, summary }) =>
        `${employee.name} | Full days: ${summary.fullDays} | Half days: ${summary.halfDays} | Leave days: ${summary.leaveDays} | Salary: Rs ${formatRupees(summary.calculatedSalary)}`
      ).join('\n')
    : 'No active employees this month.';

  const htmlRows = entries.length
    ? entries.map(({ employee, summary }) => `<tr>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;">${escapeHtml(employee.name)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;text-align:center;">${summary.fullDays}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;text-align:center;">${summary.halfDays}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;text-align:center;">${summary.leaveDays}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8df;text-align:right;font-weight:700;">&#8377;${formatRupees(summary.calculatedSalary)}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="padding:22px;text-align:center;color:#687268;">No active employees this month.</td></tr>';

  return {
    title: 'Monthly staff salary slips',
    message: `${label}: salary slips generated for ${entries.length} employee${entries.length === 1 ? '' : 's'}, totaling Rs ${formatRupees(totalSalary)}.`,
    emailSubject: `Staff Salary Slips - ${label}`,
    emailBody: `Bowline Nature Stay - Staff Salary Slips\n${label}\n\nEmployee | Full days | Half days | Leave days | Salary\n${textRows}\n\nTotal payroll: Rs ${formatRupees(totalSalary)}`,
    emailHtml: `<div style="font-family:Arial,sans-serif;color:#17362d;max-width:820px;margin:0 auto;">
      <div style="background:#102c22;color:#fff;padding:24px;border-radius:14px 14px 0 0;">
        <h1 style="margin:0;font-size:24px;">Staff Salary Slips</h1>
        <p style="margin:7px 0 0;color:#dff5aa;">${escapeHtml(label)}</p>
      </div>
      <div style="border:1px solid #dce5d9;border-top:0;padding:20px;border-radius:0 0 14px 14px;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:680px;">
          <thead><tr style="background:#dff5aa;color:#102013;">
            <th style="padding:11px;text-align:left;">Employee</th><th style="padding:11px;">Full days</th><th style="padding:11px;">Half days</th><th style="padding:11px;">Leave days</th><th style="padding:11px;text-align:right;">Salary</th>
          </tr></thead>
          <tbody>${htmlRows}</tbody>
          <tfoot><tr style="background:#102c22;color:#fff;font-weight:700;">
            <td colspan="4" style="padding:12px;">Total payroll</td><td style="padding:12px;text-align:right;">&#8377;${formatRupees(totalSalary)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`,
  };
}
