import { getLaundry, submitLaundry } from '../controllers/laundryController.js';
import { Router } from 'express';
import { login } from '../controllers/employeeAuthController.js';
import {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getChecklistTemplateForEmployee,
  getMe,
} from '../controllers/employeeController.js';
import { protectEmployee } from '../middleware/employeeAuth.js';

const router = Router();

router.post('/login', login);
router.get('/me', protectEmployee, getMe);
router.post('/checkin', protectEmployee, checkIn);
router.post('/checkout', protectEmployee, checkOut);
router.get('/attendance', protectEmployee, getAttendanceHistory);
router.get('/checklist-template', protectEmployee, getChecklistTemplateForEmployee);

router.get('/laundry', protectEmployee, getLaundry);
router.post('/laundry', protectEmployee, submitLaundry);

export default router;
