import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import { istTimeOfDay } from './istTime.js';

// A shift at or above this length counts as a full paid day; used only as
// the tiebreaker for a checkout between HALF_DAY_CUTOFF_HOUR and
// FULL_DAY_CUTOFF_HOUR, where the clock time alone doesn't decide it.
export const FULL_SHIFT_HOURS = 8;

// Checkout clock-time (IST) rules: before 8pm is always a half day, 10pm or
// later is always a full day. Between the two, fall back to hours worked.
const HALF_DAY_CUTOFF_HOUR = 20;
const FULL_DAY_CUTOFF_HOUR = 22;

// Computes the salary breakdown for one employee for one calendar month.
// `month` is a 'YYYY-MM' string; defaults to the current month.
export async function computeMonthlySalary(employee, month) {
  const monthKey = month || dayjs().format('YYYY-MM');
  const start = `${monthKey}-01`;
  const daysInMonth = dayjs(start).daysInMonth();
  const end = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;

  const [attendance, leaves] = await Promise.all([
    Attendance.find({ employee: employee._id, date: { $gte: start, $lte: end } }),
    Leave.find({ employee: employee._id, date: { $gte: start, $lte: end } }),
  ]);

  let fullDays = 0;
  let halfDays = 0;

  attendance.forEach((record) => {
    if (record.status === 'checked-out' && record.checkOutAt) {
      const checkoutHour = istTimeOfDay(record.checkOutAt);

      let isFullDay;
      if (checkoutHour < HALF_DAY_CUTOFF_HOUR) {
        isFullDay = false;
      } else if (checkoutHour >= FULL_DAY_CUTOFF_HOUR) {
        isFullDay = true;
      } else {
        const hours = dayjs(record.checkOutAt).diff(dayjs(record.checkInAt), 'minute') / 60;
        isFullDay = hours >= FULL_SHIFT_HOURS;
      }

      if (isFullDay) {
        fullDays += 1;
      } else {
        halfDays += 1;
      }
    } else {
      // Checked in but never checked out — counts as a half day worked.
      halfDays += 1;
    }
  });

  const leaveDays = leaves.length;
  const leavesPerMonth = employee.leavesPerMonth || 0;
  const paidLeaveDays = Math.min(leaveDays, leavesPerMonth);
  const excessLeaveDays = Math.max(0, leaveDays - leavesPerMonth);

  const payableDayUnits = fullDays + halfDays * 0.5 + paidLeaveDays;
  const monthlySalary = employee.monthlySalary || 0;
  const perDayRate = daysInMonth ? monthlySalary / daysInMonth : 0;
  const calculatedSalary = Math.round(perDayRate * payableDayUnits);

  return {
    month: monthKey,
    daysInMonth,
    monthlySalary,
    leavesPerMonth,
    fullDays,
    halfDays,
    leaveDays,
    paidLeaveDays,
    excessLeaveDays,
    payableDayUnits,
    calculatedSalary,
  };
}
