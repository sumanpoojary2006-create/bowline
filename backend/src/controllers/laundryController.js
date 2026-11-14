import AppSetting from '../models/AppSetting.js';
import Employee from '../models/Employee.js';
import LaundrySubmission from '../models/LaundrySubmission.js';
import LaundryStockAdjustment from '../models/LaundryStockAdjustment.js';
import { initialLaundryStock, validCount, calculateLaundry, calculateLaundryAvailability } from '../utils/laundry.js';
import { buildLaundryAdminNotification } from '../utils/laundryNotification.js';
import { notifyAdmins } from '../utils/notifications.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
const key = 'laundry-stock';
const sheetsUrl = () => process.env.APPS_SCRIPT_WEB_APP_URL;
const sheetsSecret = () => process.env.APPS_SCRIPT_OUTBOUND_SECRET || process.env.SHEETS_WEBHOOK_SECRET;
const sheetsConfigured = () => Boolean(sheetsUrl() && sheetsSecret());
async function getStock() {
  return AppSetting.findOneAndUpdate({ key }, { $setOnInsert: { value: initialLaundryStock } }, { upsert: true, new: true });
}
const todayInIndia = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
async function getLaundryAvailability(stock, date = todayInIndia()) {
  const submissions = await LaundrySubmission.find().select('date rows').lean();
  return calculateLaundryAvailability(stock, submissions, date);
}
async function sync(record) {
  if (record.synced || !sheetsConfigured()) return record;
  const response = await fetch(sheetsUrl(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upsertLaundry', secret: sheetsSecret(), submission: record.toObject() }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok || body.ok !== true) throw new Error('Google Sheets did not confirm the record.');
  record.synced = true;
  await record.save();
  return record;
}
export async function getLaundry(req, res, next) {
  try {
    const stock = await getStock();
    const history = await LaundrySubmission.find().sort({ createdAt: -1 }).limit(20);
    const availability = await getLaundryAvailability(stock.value);
    const adjustments = req.user
      ? await LaundryStockAdjustment.find().sort({ createdAt: -1 }).limit(30)
      : [];
    const staff = req.user
      ? await Employee.find({ active: true }).select('name role +laundryPinHash').sort({ name: 1 })
      : [];
    res.json({
      stock: stock.value,
      availability,
      revision: stock.__v,
      history,
      adjustments,
      sheetsConfigured: sheetsConfigured(),
      employee: req.employee ? { id: req.employee._id, name: req.employee.name } : null,
      staff: staff.map((employee) => ({
        id: employee._id,
        name: employee.name,
        role: employee.role,
        hasLaundryPin: Boolean(employee.laundryPinHash),
      })),
    });
  } catch (e) { next(e); }
}

const cleanItemName = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export async function addLaundryStockItem(req, res, next) {
  try {
    const name = cleanItemName(req.body.name);
    const count = Number(req.body.count);
    const revision = Number(req.body.revision);
    if (name.length < 2 || name.length > 80 || !validCount(count) || !Number.isInteger(revision)) {
      return res.status(400).json({ message: 'Enter an item name and a valid stock count.' });
    }
    const current = await getStock();
    if (current.__v !== revision) return res.status(409).json({ message: 'Inventory changed. Reload before adding this item.' });
    if (current.value.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ message: 'This inventory item already exists.' });
    }
    const item = { id: crypto.randomUUID(), name, stock: count };
    const saved = await AppSetting.findOneAndUpdate(
      { key, __v: revision },
      { $set: { value: [...current.value, item] }, $inc: { __v: 1 } },
      { new: true }
    );
    if (!saved) return res.status(409).json({ message: 'Inventory changed. Reload and try again.' });
    res.status(201).json({ message: `${name} added to laundry inventory.`, stock: saved.value, revision: saved.__v });
  } catch (e) { next(e); }
}

export async function updateLaundryStockItem(req, res, next) {
  try {
    const count = Number(req.body.count);
    const revision = Number(req.body.revision);
    const reason = String(req.body.reason || '').toLowerCase();
    if (!validCount(count) || !Number.isInteger(revision)) return res.status(400).json({ message: 'Enter a valid stock count.' });
    const current = await getStock();
    if (current.__v !== revision) return res.status(409).json({ message: 'Inventory changed. Reload before saving.' });
    const currentItem = current.value.find((item) => item.id === req.params.id);
    if (!currentItem) return res.status(404).json({ message: 'Inventory item not found.' });
    const reduction = currentItem.stock - count;
    if (reduction > 0 && !['lost', 'damaged'].includes(reason)) {
      return res.status(400).json({ message: 'Choose whether the reduced stock was lost or damaged.' });
    }
    const value = current.value.map((item) => item.id === req.params.id ? { ...item, stock: count } : item);
    const saved = await AppSetting.findOneAndUpdate(
      { key, __v: revision },
      { $set: { value }, $inc: { __v: 1 } },
      { new: true }
    );
    if (!saved) return res.status(409).json({ message: 'Inventory changed. Reload and try again.' });
    let adjustment = null;
    if (reduction > 0) {
      try {
        adjustment = await LaundryStockAdjustment.create({
          itemId: currentItem.id,
          itemName: currentItem.name,
          previousStock: currentItem.stock,
          newStock: count,
          quantity: reduction,
          reason,
          adminId: req.user._id,
          adminName: req.user.name,
        });
      } catch (error) {
        await AppSetting.findOneAndUpdate(
          { key, __v: saved.__v },
          { $set: { value: current.value }, $inc: { __v: 1 } },
          { new: true }
        );
        throw error;
      }
    }
    const message = adjustment
      ? `${reduction} ${currentItem.name} marked as ${reason}.`
      : 'Stock count updated.';
    res.json({ message, stock: saved.value, revision: saved.__v, adjustment });
  } catch (e) { next(e); }
}

export async function setLaundryStaffPin(req, res, next) {
  try {
    const pin = String(req.body.pin || '');
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ message: 'The laundry PIN must contain exactly 4 digits.' });
    const employee = await Employee.findById(req.params.employeeId).select('+laundryPinHash');
    if (!employee || !employee.active) return res.status(404).json({ message: 'Active staff member not found.' });
    employee.laundryPinHash = await bcrypt.hash(pin, 10);
    await employee.save();
    res.json({ message: `Laundry PIN set for ${employee.name}.` });
  } catch (e) { next(e); }
}
export async function submitLaundry(req, res, next) {
  try {
    const { entries, requestId, revision } = req.body;
    if (!req.employee || typeof requestId !== 'string' || !/^[\w-]{16,80}$/.test(requestId)) return res.status(400).json({ message: 'A valid employee login and submission are required.' });
    const staffId = String(req.employee._id);
    const staffName = req.employee.name;
    let record = await LaundrySubmission.findOne({ requestId });
    if (record && record.staffId !== staffId) return res.status(403).json({ message: 'Submission belongs to another staff member.' });
    if (!record) {
      const stock = await getStock();
      if (stock.__v !== revision) return res.status(409).json({ message: 'Admin stock changed. Reload and review your counts.' });
      let rows;
      const date = todayInIndia();
      const availability = await getLaundryAvailability(stock.value, date);
      try { rows = calculateLaundry(stock.value, entries, availability); } catch (e) { return res.status(400).json({ message: e.message }); }
      try { record = await LaundrySubmission.create({ requestId, date, staffName, staffId, rows }); }
      catch (e) { if (e.code !== 11000) throw e; record = await LaundrySubmission.findOne({ requestId }); }
    }
    try { await sync(record); } catch { /* Retain durable submission for retry. */ }
    if (!record.adminNotified) {
      try {
        const notification = buildLaundryAdminNotification(record);
        const delivery = await notifyAdmins({ ...notification, type: 'system' });
        if (delivery.emailSent) {
          record.adminNotified = true;
          await record.save();
        }
      } catch (error) {
        console.error('Failed to notify admins about laundry submission', error);
      }
    }
    const savedMessage = record.synced ? 'Saved to Google Sheets.' : 'Saved in Bowline. Google Sheets sync pending.';
    const emailMessage = record.adminNotified ? ' Admin email sent.' : ' Admin email is pending.';
    const stock = await getStock();
    const availability = await getLaundryAvailability(stock.value, todayInIndia());
    res.json({ record, availability, message: `${savedMessage}${emailMessage}` });
  } catch (e) { next(e); }
}
export async function retryLaundrySync(req, res, next) {
  try {
    const record = await LaundrySubmission.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Submission not found.' });
    await sync(record);
    res.json({ message: record.synced ? 'Synced to Google Sheets.' : 'Google Sheets is not configured.' });
  } catch (e) { next(e); }
}
