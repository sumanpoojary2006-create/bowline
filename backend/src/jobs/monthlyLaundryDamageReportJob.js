import cron from 'node-cron';
import AppSetting from '../models/AppSetting.js';
import LaundryStockAdjustment from '../models/LaundryStockAdjustment.js';
import { buildLaundryDamageReport, getPreviousMonthWindow } from '../utils/laundryDamageReport.js';
import { notifyAdmins } from '../utils/notifications.js';

export async function sendMonthlyLaundryDamageReport({ now = new Date(), force = false } = {}) {
  const window = getPreviousMonthWindow(now);
  const deliveryKey = `laundry-damage-report:${window.key}`;
  const previousDelivery = await AppSetting.findOne({ key: deliveryKey }).lean();
  if (!force && previousDelivery?.value?.status === 'sent') {
    return { skipped: true, reason: 'Monthly report already sent', month: window.label };
  }

  const adjustments = await LaundryStockAdjustment.find({
    createdAt: { $gte: window.start, $lt: window.end },
  }).sort({ createdAt: 1 }).lean();
  const report = buildLaundryDamageReport(adjustments, window.label);
  const delivery = await notifyAdmins({ ...report, type: 'system' });
  if (!delivery.emailSent) throw new Error('Monthly laundry report email could not be sent.');

  await AppSetting.findOneAndUpdate(
    { key: deliveryKey },
    { $set: { value: { status: 'sent', sentAt: new Date(), entries: adjustments.length, totals: report.totals } } },
    { upsert: true, new: true }
  );

  return { skipped: false, month: window.label, entries: adjustments.length, totals: report.totals };
}

export function scheduleMonthlyLaundryDamageReport() {
  const schedule = process.env.MONTHLY_LAUNDRY_REPORT_CRON || '15 20 1 * *';
  cron.schedule(schedule, () => {
    sendMonthlyLaundryDamageReport().catch((error) => {
      console.error('Failed to send monthly laundry loss and damage report', error);
    });
  }, { timezone: 'UTC' });
  console.log(`Monthly laundry loss and damage report scheduled (${schedule} UTC)`);
}
