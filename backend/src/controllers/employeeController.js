import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import ChecklistSubmission from '../models/ChecklistSubmission.js';
import Leave from '../models/Leave.js';
import LaundrySubmission from '../models/LaundrySubmission.js';
import { resolveChecklistFields } from '../utils/checklistFields.js';
import { buildChecklistResponses, computeChecklistScore } from '../utils/scoring.js';
import { getClientIp } from '../utils/network.js';
import { writeAttendanceToSheet, writeSalarySummaryToSheet } from '../utils/googleSheets.js';
import { computeMonthlySalary, isFullDayCheckout } from '../utils/salary.js';
import { buildAttendanceCalendar } from '../utils/attendanceCalendar.js';
import { istTimeOfDay } from '../utils/istTime.js';

// Check-in after this hour (IST) is flagged as late — a warning only, never
// a block, since staff must always be able to check in.
const LATE_CHECK_IN_HOUR = 7;
// Falls back to this when an admin hasn't set a specific leave allowance for
// an employee yet (Employee.leavesPerMonth defaults to 0, which would
// otherwise read as "no leave allowed at all").
const DEFAULT_LEAVES_PER_MONTH = 4;

const todayKey = () => dayjs().format('YYYY-MM-DD');

// Housekeeping must submit today's laundry list before they can check out;
// other roles have no required task yet (e.g. kitchen's checklist is future work).
const getTodayTaskStatus = async (employee, date) => {
  if (employee.role !== 'housekeeping') {
    return { laundryRequired: false, laundryDone: true };
  }

  const laundryDone = await LaundrySubmission.exists({ staffId: String(employee._id), date });
  return { laundryRequired: true, laundryDone: Boolean(laundryDone) };
};

// Reuses the same monthly tally the salary calculator uses, so "days this
// month" and the attendance score are always consistent with the payroll
// numbers the admin sees for the same employee. Built from actual
// leave/attendance records rather than days-in-month, so it never
// penalizes for days later in the month that simply haven't happened yet.
//
// The score is a fill, not a depleting penalty: it starts at 0% on day one
// and rises as full/half days are actually worked, reaching 100% once
// they've worked every required day this month (days in month minus the
// leave allowance — e.g. 26 of 30 with a 4-day allowance). Taking more
// leave than the allowance simply leaves fewer days available to fill it
// with, so it tops out below 100% rather than needing a separate penalty.
const getMonthlyAttendanceStats = async (employee) => {
  const monthly = await computeMonthlySalary(employee, dayjs().format('YYYY-MM'));
  const leaveAllowance = employee.leavesPerMonth > 0 ? employee.leavesPerMonth : DEFAULT_LEAVES_PER_MONTH;
  const attendedUnits = monthly.fullDays + monthly.halfDays * 0.5;
  const requiredDays = Math.max(1, monthly.daysInMonth - leaveAllowance);
  const leaveScore = Math.min(100, Math.round((attendedUnits / requiredDays) * 100));

  return {
    attendanceSummary: {
      daysPresent: monthly.fullDays + monthly.halfDays,
      daysInPeriod: monthly.daysInMonth,
    },
    leaveScore,
    leaveAllowance,
  };
};

export const getMe = async (req, res, next) => {
  try {
    const date = todayKey();
    const [attendanceStats, todayAttendance, todayLeave, todayTasks] = await Promise.all([
      getMonthlyAttendanceStats(req.employee),
      Attendance.findOne({ employee: req.employee._id, date }),
      Leave.findOne({ employee: req.employee._id, date }),
      getTodayTaskStatus(req.employee, date),
    ]);

    res.json({
      employee: {
        id: req.employee._id,
        name: req.employee.name,
        phone: req.employee.phone,
        email: req.employee.email,
        role: req.employee.role,
        joinDate: req.employee.joinDate,
      },
      attendanceSummary: attendanceStats.attendanceSummary,
      leaveScore: attendanceStats.leaveScore,
      leaveAllowance: attendanceStats.leaveAllowance,
      today: todayAttendance
        ? {
            status: todayAttendance.status,
            checkInAt: todayAttendance.checkInAt,
            checkOutAt: todayAttendance.checkOutAt,
            lateCheckIn: todayAttendance.lateCheckIn,
            dayType:
              todayAttendance.status === 'checked-out' && todayAttendance.checkOutAt
                ? isFullDayCheckout(todayAttendance.checkOutAt)
                  ? 'full'
                  : 'half'
                : null,
          }
        : null,
      isOnLeaveToday: Boolean(todayLeave),
      todayTasks,
    });
  } catch (error) {
    next(error);
  }
};

export const checkIn = async (req, res, next) => {
  try {
    const date = todayKey();
    const existing = await Attendance.findOne({ employee: req.employee._id, date });

    if (existing) {
      res.status(400);
      throw new Error(
        existing.status === 'checked-out'
          ? 'You have already completed your shift today'
          : 'You are already signed in for today'
      );
    }

    const onLeave = await Leave.findOne({ employee: req.employee._id, date });
    if (onLeave) {
      res.status(403);
      throw new Error('You are on leave today — sign-in is disabled');
    }

    const clientIp = getClientIp(req);
    const checkInAt = new Date();
    const lateCheckIn = istTimeOfDay(checkInAt) > LATE_CHECK_IN_HOUR;

    const attendance = await Attendance.create({
      employee: req.employee._id,
      date,
      checkInAt,
      checkInIp: clientIp,
      lateCheckIn,
    });

    // Awaited, not fire-and-forget: on a serverless platform the function
    // can freeze as soon as the response is sent, which would silently kill
    // an in-flight Apps Script request before it completes.
    await writeAttendanceToSheet({
      employeeName: req.employee.name,
      date,
      checkInAt: attendance.checkInAt,
      checkOutAt: null,
    }).catch(() => {});

    res.status(201).json({
      attendance: {
        status: attendance.status,
        checkInAt: attendance.checkInAt,
        lateCheckIn: attendance.lateCheckIn,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getChecklistTemplateForEmployee = async (req, res, next) => {
  try {
    const fields = await resolveChecklistFields(req.employee.role);
    res.json({
      type: req.employee.role,
      fields,
    });
  } catch (error) {
    next(error);
  }
};

export const checkOut = async (req, res, next) => {
  try {
    const date = todayKey();
    const attendance = await Attendance.findOne({ employee: req.employee._id, date });

    if (!attendance || attendance.status !== 'checked-in') {
      res.status(400);
      throw new Error('No active sign-in found for today');
    }

    const { answers } = req.body;

    if (!answers || typeof answers !== 'object') {
      res.status(400);
      throw new Error('Checklist answers are required to sign out');
    }

    const fields = await resolveChecklistFields(req.employee.role);
    const responses = buildChecklistResponses(fields, answers);
    const totalScore = computeChecklistScore(responses);

    const checklist = await ChecklistSubmission.create({
      attendance: attendance._id,
      employee: req.employee._id,
      type: req.employee.role,
      responses,
      totalScore,
    });

    attendance.checkOutAt = new Date();
    attendance.status = 'checked-out';
    attendance.checklist = checklist._id;
    attendance.score = totalScore;
    await attendance.save();

    // Awaited for the same reason as in checkIn — a serverless function can
    // freeze right after the response is sent, before a fire-and-forget
    // Apps Script request finishes.
    await writeAttendanceToSheet({
      employeeName: req.employee.name,
      date,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
    }).catch(() => {});

    await computeMonthlySalary(req.employee, dayjs(date).format('YYYY-MM'))
      .then((summary) =>
        writeSalarySummaryToSheet({ month: summary.month, employeeName: req.employee.name, summary })
      )
      .catch(() => {});

    res.json({
      attendance: {
        status: attendance.status,
        checkInAt: attendance.checkInAt,
        checkOutAt: attendance.checkOutAt,
        dayType: isFullDayCheckout(attendance.checkOutAt) ? 'full' : 'half',
      },
      score: totalScore,
    });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceHistory = async (req, res, next) => {
  try {
    const records = await Attendance.find({ employee: req.employee._id })
      .sort({ date: -1 })
      .limit(60)
      .populate('checklist', 'totalScore adminReviewed');

    res.json({ attendance: records });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceCalendar = async (req, res, next) => {
  try {
    const result = await buildAttendanceCalendar(req.employee._id, req.query.month);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
