import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import ChecklistSubmission from '../models/ChecklistSubmission.js';
import ChecklistItem from '../models/ChecklistItem.js';
import AppSetting from '../models/AppSetting.js';
import { getChecklistTemplate } from '../config/checklistTemplates.js';
import { slugify } from '../utils/slugify.js';

const ATTENDANCE_WINDOW_DAYS = 30;

const CHECKLIST_ROLES = ['housekeeping', 'kitchen'];
const CHECKLIST_FIELD_TYPES = ['boolean', 'status', 'number', 'text'];

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

// ---------------------------------------------------------------------------
// Checklist editor — admin-managed checklist fields per employee type (role)
// ---------------------------------------------------------------------------

const formatChecklistItem = (item) => ({
  id: item._id,
  role: item.role,
  key: item.key,
  label: item.label,
  type: item.type,
  maxPoints: item.maxPoints,
  order: item.order,
  active: item.active,
});

// First time a role's checklist is opened, import the built-in defaults into
// the DB so the admin always edits real, persisted rows.
const ensureChecklistItemsSeeded = async (role) => {
  const count = await ChecklistItem.countDocuments({ role });
  if (count > 0) return;

  const defaults = getChecklistTemplate(role);
  await ChecklistItem.insertMany(
    defaults.map((field, index) => ({
      role,
      key: field.key,
      label: field.label,
      type: field.type,
      maxPoints: field.maxPoints,
      order: index,
      active: true,
    })),
    { ordered: false }
  ).catch(() => {});
};

const uniqueKeyForRole = async (role, baseLabel, excludeId = null) => {
  const base = slugify(baseLabel) || 'item';
  let key = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await ChecklistItem.exists({ role, key, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  return key;
};

export const getChecklistItems = async (req, res, next) => {
  try {
    const roles = req.query.role
      ? CHECKLIST_ROLES.filter((role) => role === req.query.role)
      : CHECKLIST_ROLES;

    if (!roles.length) {
      res.status(400);
      throw new Error('Invalid employee type');
    }

    await Promise.all(roles.map(ensureChecklistItemsSeeded));

    const items = await ChecklistItem.find({ role: { $in: roles } }).sort({
      role: 1,
      order: 1,
      createdAt: 1,
    });

    res.json({ items: items.map(formatChecklistItem) });
  } catch (error) {
    next(error);
  }
};

export const createChecklistItem = async (req, res, next) => {
  try {
    const { role, label, type, maxPoints } = req.body;

    if (!CHECKLIST_ROLES.includes(role)) {
      res.status(400);
      throw new Error('A valid employee type is required');
    }
    if (!label || !String(label).trim()) {
      res.status(400);
      throw new Error('Label is required');
    }
    if (!CHECKLIST_FIELD_TYPES.includes(type)) {
      res.status(400);
      throw new Error('A valid field type is required');
    }

    const points = type === 'text' ? 0 : Math.max(0, Number(maxPoints) || 0);
    const key = await uniqueKeyForRole(role, label);

    const last = await ChecklistItem.findOne({ role }).sort({ order: -1 }).select('order');
    const order = last ? last.order + 1 : 0;

    const item = await ChecklistItem.create({
      role,
      key,
      label: String(label).trim(),
      type,
      maxPoints: points,
      order,
      active: true,
    });

    res.status(201).json({ item: formatChecklistItem(item) });
  } catch (error) {
    next(error);
  }
};

export const updateChecklistItem = async (req, res, next) => {
  try {
    const item = await ChecklistItem.findById(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Checklist item not found');
    }

    const { label, type, maxPoints, active, role } = req.body;

    if (role !== undefined && role !== item.role) {
      if (!CHECKLIST_ROLES.includes(role)) {
        res.status(400);
        throw new Error('Invalid employee type');
      }
      item.key = await uniqueKeyForRole(role, item.label, item._id);
      item.role = role;
    }

    if (label !== undefined) {
      if (!String(label).trim()) {
        res.status(400);
        throw new Error('Label cannot be empty');
      }
      item.label = String(label).trim();
    }

    if (type !== undefined) {
      if (!CHECKLIST_FIELD_TYPES.includes(type)) {
        res.status(400);
        throw new Error('Invalid field type');
      }
      item.type = type;
    }

    if (maxPoints !== undefined) {
      item.maxPoints = Math.max(0, Number(maxPoints) || 0);
    }

    // Text fields are informational only — they never carry points.
    if (item.type === 'text') {
      item.maxPoints = 0;
    }

    if (active !== undefined) {
      item.active = Boolean(active);
    }

    await item.save();

    res.json({ item: formatChecklistItem(item) });
  } catch (error) {
    next(error);
  }
};

export const deleteChecklistItem = async (req, res, next) => {
  try {
    const item = await ChecklistItem.findByIdAndDelete(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Checklist item not found');
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const reorderChecklistItems = async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      res.status(400);
      throw new Error('orderedIds must be an array of checklist item ids');
    }

    await Promise.all(
      orderedIds.map((id, index) => ChecklistItem.findByIdAndUpdate(id, { order: index }))
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
