import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import ChecklistSubmission from '../models/ChecklistSubmission.js';
import AppSetting from '../models/AppSetting.js';

const ATTENDANCE_WINDOW_DAYS = 30;

const formatEmployee = (employee) => ({
  id: employee._id,
  name: employee.name,
  phone: employee.phone,
  email: employee.email,
  role: employee.role,
  active: employee.active,
  joinDate: employee.joinDate,
});

export const getEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });

    const scores = await ChecklistSubmission.aggregate([
      { $group: { _id: '$employee', avgScore: { $avg: '$totalScore' } } },
    ]);
    const scoreMap = new Map(scores.map((entry) => [String(entry._id), Math.round(entry.avgScore)]));

    res.json({
      employees: employees.map((employee) => ({
        ...formatEmployee(employee),
        score: scoreMap.get(String(employee._id)) ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (req, res, next) => {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !password || !role) {
      res.status(400);
      throw new Error('Name, phone, password, and role are required');
    }

    const existing = await Employee.findOne({ phone });
    if (existing) {
      res.status(400);
      throw new Error('An employee with this phone number already exists');
    }

    const employee = await Employee.create({ name, phone, email, password, role });

    res.status(201).json({ employee: formatEmployee(employee) });
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      res.status(404);
      throw new Error('Employee not found');
    }

    const { name, email, role, active, password } = req.body;

    if (name !== undefined) employee.name = name;
    if (email !== undefined) employee.email = email;
    if (role !== undefined) employee.role = role;
    if (active !== undefined) employee.active = active;
    if (password) employee.password = password;

    await employee.save();

    res.json({ employee: formatEmployee(employee) });
  } catch (error) {
    next(error);
  }
};

export const getAllAttendance = async (req, res, next) => {
  try {
    const { employeeId } = req.query;
    const filter = employeeId ? { employee: employeeId } : {};

    const attendance = await Attendance.find(filter)
      .sort({ date: -1 })
      .limit(200)
      .populate('employee', 'name role phone')
      .populate('checklist', 'totalScore adminReviewed type');

    res.json({ attendance });
  } catch (error) {
    next(error);
  }
};

export const getChecklistSubmissions = async (req, res, next) => {
  try {
    const { employeeId, reviewed } = req.query;
    const filter = {};
    if (employeeId) filter.employee = employeeId;
    if (reviewed === 'true') filter.adminReviewed = true;
    if (reviewed === 'false') filter.adminReviewed = false;

    const submissions = await ChecklistSubmission.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('employee', 'name role phone')
      .populate('attendance', 'date checkInAt checkOutAt');

    res.json({ submissions });
  } catch (error) {
    next(error);
  }
};

export const reviewChecklistSubmission = async (req, res, next) => {
  try {
    const submission = await ChecklistSubmission.findById(req.params.id);

    if (!submission) {
      res.status(404);
      throw new Error('Checklist submission not found');
    }

    const { totalScore, adminNotes, adminReviewed } = req.body;

    if (totalScore !== undefined) {
      submission.totalScore = totalScore;
      await Attendance.findByIdAndUpdate(submission.attendance, { score: totalScore });
    }
    if (adminNotes !== undefined) submission.adminNotes = adminNotes;
    if (adminReviewed !== undefined) {
      submission.adminReviewed = adminReviewed;
      submission.reviewedBy = req.user._id;
      submission.reviewedAt = new Date();
    }

    await submission.save();

    res.json({ submission });
  } catch (error) {
    next(error);
  }
};

export const getWifiSetting = async (req, res, next) => {
  try {
    const setting = await AppSetting.findOne({ key: 'employee_wifi' });
    res.json({ allowedIps: setting?.allowedIps || [] });
  } catch (error) {
    next(error);
  }
};

export const updateWifiSetting = async (req, res, next) => {
  try {
    const { allowedIps } = req.body;

    if (!Array.isArray(allowedIps)) {
      res.status(400);
      throw new Error('allowedIps must be an array of IP addresses');
    }

    const setting = await AppSetting.findOneAndUpdate(
      { key: 'employee_wifi' },
      { allowedIps: allowedIps.map((ip) => String(ip).trim()).filter(Boolean) },
      { upsert: true, new: true }
    );

    res.json({ allowedIps: setting.allowedIps });
  } catch (error) {
    next(error);
  }
};
