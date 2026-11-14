import dayjs from 'dayjs';
import Attendance from '../models/Attendance.js';
import ChecklistSubmission from '../models/ChecklistSubmission.js';
import AppSetting from '../models/AppSetting.js';
import Leave from '../models/Leave.js';
import LaundrySubmission from '../models/LaundrySubmission.js';
import { resolveChecklistFields } from '../utils/checklistFields.js';
import { buildChecklistResponses, computeChecklistScore } from '../utils/scoring.js';
import { getClientIp, isAllowedIp } from '../utils/network.js';
import { writeAttendanceToSheet, writeSalarySummaryToSheet } from '../utils/googleSheets.js';
import { computeMonthlySalary, FULL_SHIFT_HOURS } from '../utils/salary.js';

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
    const setting = await AppSetting.findOne({ key: 'employee_wifi' });
    const allowedIps = setting?.allowedIps || [];

    if (!allowedIps.length || !isAllowedIp(clientIp, allowedIps)) {
      res.status(403);
      throw new Error('Connect to the homestay WiFi to check in');
    }

    const attendance = await Attendance.create({
      employee: req.employee._id,
      date,
      checkInAt: new Date(),
      checkInIp: clientIp,
    });

    writeAttendanceToSheet({
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

    writeAttendanceToSheet({
      employeeName: req.employee.name,
      date,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
    }).catch(() => {});

    computeMonthlySalary(req.employee, dayjs(date).format('YYYY-MM'))
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

// One status per calendar day: 'full' (green), 'partial' (yellow), or
// 'leave'/'absent' (both rendered red — on leave or no check-in at all).
// Days in the future with no leave applied are omitted (status unknown yet).
export const getAttendanceCalendar = async (req, res, next) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : dayjs().format('YYYY-MM');
    const start = `${month}-01`;
    const daysInMonth = dayjs(start).daysInMonth();
    const end = `${month}-${String(daysInMonth).padStart(2, '0')}`;
    const today = todayKey();

    const [attendance, leaves] = await Promise.all([
      Attendance.find({ employee: req.employee._id, date: { $gte: start, $lte: end } }),
      Leave.find({ employee: req.employee._id, date: { $gte: start, $lte: end } }),
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

    res.json({ month, days });
  } catch (error) {
    next(error);
  }
};

// Staff apply their own leave; it takes effect immediately (no admin
// approval step) and blocks check-in for those dates from then on.
export const applyLeave = async (req, res, next) => {
  try {
    const { dates } = req.body;

    if (!Array.isArray(dates) || !dates.length) {
      res.status(400);
      throw new Error('Select at least one date for your leave application');
    }

    const cleanDates = [...new Set(dates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
    if (!cleanDates.length) {
      res.status(400);
      throw new Error('Invalid date selection');
    }

    const worked = await Attendance.find({ employee: req.employee._id, date: { $in: cleanDates } }).select(
      'date'
    );
    if (worked.length) {
      res.status(400);
      throw new Error(`You already have attendance recorded for ${worked.map((w) => w.date).join(', ')}`);
    }

    const created = [];
    for (const date of cleanDates) {
      // eslint-disable-next-line no-await-in-loop
      const leave = await Leave.findOneAndUpdate(
        { employee: req.employee._id, date },
        { employee: req.employee._id, date },
        { upsert: true, new: true }
      );
      created.push(leave.date);
    }

    res.status(201).json({ dates: created });
  } catch (error) {
    next(error);
  }
};

export const getMyLeaves = async (req, res, next) => {
  try {
    const { month } = req.query;
    const filter = { employee: req.employee._id };
    if (/^\d{4}-\d{2}$/.test(month)) {
      filter.date = { $gte: `${month}-01`, $lte: `${month}-31` };
    }

    const leaves = await Leave.find(filter).sort({ date: 1 });
    res.json({ leaves: leaves.map((leave) => leave.date) });
  } catch (error) {
    next(error);
  }
};
