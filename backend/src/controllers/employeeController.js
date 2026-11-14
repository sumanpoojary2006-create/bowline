import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import ChecklistSubmission from '../models/ChecklistSubmission.js';
import Leave from '../models/Leave.js';
import LaundrySubmission from '../models/LaundrySubmission.js';
import { resolveChecklistFields } from '../utils/checklistFields.js';
import { buildChecklistResponses, computeChecklistScore } from '../utils/scoring.js';
import { getClientIp } from '../utils/network.js';
import { writeAttendanceToSheet, writeSalarySummaryToSheet } from '../utils/googleSheets.js';
import { computeMonthlySalary } from '../utils/salary.js';
import { buildAttendanceCalendar } from '../utils/attendanceCalendar.js';

const MIN_SHIFT_HOURS = 5;
const ATTENDANCE_WINDOW_DAYS = 30;

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

const getAttendanceSummary = async (employeeId) => {
  const since = dayjs().subtract(ATTENDANCE_WINDOW_DAYS, 'day').format('YYYY-MM-DD');

  const daysPresent = await Attendance.countDocuments({
    employee: employeeId,
    date: { $gte: since },
  });

  return {
    daysPresent,
    daysInPeriod: ATTENDANCE_WINDOW_DAYS,
  };
};

const getCurrentScore = async (employeeId) => {
  const submissions = await ChecklistSubmission.find({ employee: employeeId })
    .sort({ createdAt: -1 })
    .limit(ATTENDANCE_WINDOW_DAYS)
    .select('totalScore');

  if (!submissions.length) {
    return null;
  }

  const total = submissions.reduce((sum, item) => sum + item.totalScore, 0);
  return Math.round(total / submissions.length);
};

export const getMe = async (req, res, next) => {
  try {
    const date = todayKey();
    const [attendanceSummary, score, todayAttendance, todayLeave, todayTasks] = await Promise.all([
      getAttendanceSummary(req.employee._id),
      getCurrentScore(req.employee._id),
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
      attendanceSummary,
      score,
      today: todayAttendance
        ? {
            status: todayAttendance.status,
            checkInAt: todayAttendance.checkInAt,
            checkOutAt: todayAttendance.checkOutAt,
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
          : 'You are already checked in for today'
      );
    }

    const onLeave = await Leave.findOne({ employee: req.employee._id, date });
    if (onLeave) {
      res.status(403);
      throw new Error('You are on leave today — check-in is disabled');
    }

    const clientIp = getClientIp(req);

    const attendance = await Attendance.create({
      employee: req.employee._id,
      date,
      checkInAt: new Date(),
      checkInIp: clientIp,
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
      throw new Error('No active check-in found for today');
    }

    const elapsedHours = dayjs().diff(dayjs(attendance.checkInAt), 'minute') / 60;

    if (elapsedHours < MIN_SHIFT_HOURS) {
      const remainingMinutes = Math.ceil((MIN_SHIFT_HOURS - elapsedHours) * 60);
      res.status(403);
      throw new Error(
        `You can check out after ${remainingMinutes} more minute(s) (minimum ${MIN_SHIFT_HOURS}-hour shift)`
      );
    }

    const taskStatus = await getTodayTaskStatus(req.employee, date);
    if (taskStatus.laundryRequired && !taskStatus.laundryDone) {
      res.status(400);
      throw new Error("Complete today's laundry dashboard before checking out");
    }

    const { answers } = req.body;

    if (!answers || typeof answers !== 'object') {
      res.status(400);
      throw new Error('Checklist answers are required to check out');
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
