import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import { FULL_SHIFT_HOURS } from './salary.js';

// One status per calendar day: 'full' (green), 'partial' (yellow), or
// 'leave'/'absent' (both rendered red — on leave or no check-in at all).
// Days in the future with no leave applied are omitted (status unknown yet).
export async function buildAttendanceCalendar(employeeId, monthParam) {
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : dayjs().format('YYYY-MM');
  const start = `${month}-01`;
  const daysInMonth = dayjs(start).daysInMonth();
  const end = `${month}-${String(daysInMonth).padStart(2, '0')}`;
  const today = dayjs().format('YYYY-MM-DD');

  const [attendance, leaves] = await Promise.all([
    Attendance.find({ employee: employeeId, date: { $gte: start, $lte: end } }),
    Leave.find({ employee: employeeId, date: { $gte: start, $lte: end } }),
  ]);

  const attendanceByDate = new Map(attendance.map((record) => [record.date, record]));
  const leaveDates = new Set(leaves.map((leave) => leave.date));

  const days = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    let status = null;

    if (leaveDates.has(date)) {
      status = 'leave';
    } else {
      const record = attendanceByDate.get(date);
      if (record) {
        if (record.status === 'checked-out' && record.checkOutAt) {
          const hours = dayjs(record.checkOutAt).diff(dayjs(record.checkInAt), 'minute') / 60;
          status = hours >= FULL_SHIFT_HOURS ? 'full' : 'partial';
        } else {
          status = 'partial';
        }
      } else if (date <= today) {
        status = 'absent';
      }
    }

    days.push({ date, status });
  }

  return { month, days };
}
