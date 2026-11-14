import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';

// A completed shift longer than this many hours counts as a full day;
// shorter counts as half (signing out before a 5-hour minimum is blocked
// at the point of sign-out, in employeeController.js — this function only
// ever sees shifts that already cleared that bar, plus the rare shift an
// employee never signed out of, auto-closed at day's end, which can be
// shorter). Shared by the salary calculation and the attendance calendar
// display, so both always agree on whether a given day was a full or half
// day.
const FULL_DAY_HOURS = 10;

export const getDayType = (checkInAt, checkOutAt) => {
  const hours = dayjs(checkOutAt).diff(dayjs(checkInAt), 'minute') / 60;
  return hours > FULL_DAY_HOURS ? 'full' : 'half';
};

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
    if (record.status === 'checked-out' && record.checkOutAt && getDayType(record.checkInAt, record.checkOutAt) === 'full') {
      fullDays += 1;
    } else {
      // Under the full-day threshold, or never signed out at all — half day.
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
