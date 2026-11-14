import cron from 'node-cron';
import AppSetting from '../models/AppSetting.js';
import Employee from '../models/Employee.js';
import { computeMonthlySalary } from '../utils/salary.js';
import { buildSalarySlipReport } from '../utils/salarySlipReport.js';
import { getPreviousMonthWindow } from '../utils/laundryDamageReport.js';
import { notifyAdmins } from '../utils/notifications.js';

export async function sendMonthlySalarySlips({ now = new Date(), force = false } = {}) {
  const window = getPreviousMonthWindow(now);
  const deliveryKey = `salary-slips:${window.key}`;
  const previousDelivery = await AppSetting.findOne({ key: deliveryKey }).lean();
  if (!force && previousDelivery?.value?.status === 'sent') {
    return { skipped: true, reason: 'Monthly salary slips already sent', month: window.label };
  }

  const employees = await Employee.find({ active: true });
  const slips = await Promise.all(
    employees.map(async (employee) => ({
      employee,
      summary: await computeMonthlySalary(employee, window.key),
    }))
  );

  const report = buildSalarySlipReport(slips, window.label);
  const delivery = await notifyAdmins({ ...report, type: 'system' });
  if (!delivery.emailSent) throw new Error('Monthly salary slip email could not be sent.');

  const totalSalary = slips.reduce((sum, { summary }) => sum + summary.calculatedSalary, 0);

  await AppSetting.findOneAndUpdate(
    { key: deliveryKey },
    { $set: { value: { status: 'sent', sentAt: new Date(), employees: slips.length, totalSalary } } },
    { upsert: true, new: true }
  );

  return { skipped: false, month: window.label, employees: slips.length, totalSalary };
}

export function scheduleMonthlySalarySlipJob() {
  // 30 3 1 * * UTC = 9:00 AM IST on the 1st — stays within "day 1" in both
  // timezones, unlike a schedule near IST midnight which would need to fire
  // on the UTC calendar's last day of the previous month.
  const schedule = process.env.MONTHLY_SALARY_SLIP_CRON || '30 3 1 * *';
  cron.schedule(schedule, () => {
    sendMonthlySalarySlips().catch((error) => {
      console.error('Failed to send monthly salary slips', error);
    });
  }, { timezone: 'UTC' });
  console.log(`Monthly staff salary slips scheduled (${schedule} UTC)`);
}
