import cron from 'node-cron';
import Attendance from '../models/Attendance.js';
import { todayPropertyDateKey } from '../utils/bookingDates.js';
import { istWallTimeToDate } from '../utils/istTime.js';

// Staff who forget to sign out stay "checked-in" indefinitely otherwise —
// this closes out any shift still open at day's end (IST) so it gets a
// checkOutAt and a day-type like every other shift, instead of silently
// bleeding into the next day's attendance.
export async function autoSignOutForgottenShifts({ now = new Date() } = {}) {
  const date = todayPropertyDateKey(now);
  const checkOutAt = istWallTimeToDate(date, 23, 59);

  const openShifts = await Attendance.find({ date, status: 'checked-in' });

  await Promise.all(
    openShifts.map((attendance) => {
      attendance.checkOutAt = checkOutAt;
      attendance.status = 'checked-out';
      attendance.autoSignedOut = true;
      return attendance.save();
    })
  );

  return { date, autoSignedOut: openShifts.length };
}

export function scheduleAutoSignOutJob() {
  // 29 18 * * * UTC = 23:59 IST.
  const schedule = process.env.AUTO_SIGNOUT_CRON || '29 18 * * *';

  cron.schedule(
    schedule,
    () => {
      autoSignOutForgottenShifts().catch((error) => {
        console.error('Failed to auto sign out forgotten shifts', error);
      });
    },
    { timezone: 'UTC' }
  );

  console.log(`Auto sign-out for forgotten shifts scheduled (${schedule} UTC)`);
}
