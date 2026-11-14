import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import { istTimeOfDay } from './istTime.js';

// A checkout at or after this hour (IST) counts as a full day; earlier than
// that — including never checking out at all — counts as half. Shared by
// the salary calculation and the attendance calendar display, so both
// always agree on whether a given day was a full or half day.
const FULL_DAY_CHECKOUT_HOUR = 20;

export const isFullDayCheckout = (checkOutAt) => istTimeOfDay(checkOutAt) >= FULL_DAY_CHECKOUT_HOUR;

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
    if (record.status === 'checked-out' && record.checkOutAt && isFullDayCheckout(record.checkOutAt)) {
      fullDays += 1;
    } else {
      // Checked out before the cutoff, or never checked out at all — half day.
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
