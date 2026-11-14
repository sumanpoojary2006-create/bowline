import { getLaundry, submitLaundry } from '../controllers/laundryController.js';
import { Router } from 'express';
import { login } from '../controllers/employeeAuthController.js';
import {
  autoSignOutCron,
  checkIn,
  checkOut,
  getAttendanceCalendar,
  getAttendanceHistory,
  getMe,
} from '../controllers/employeeController.js';
import { protectEmployee } from '../middleware/employeeAuth.js';

const router = Router();

// Vercel Cron calls this — authenticated by CRON_SECRET bearer token
router.get('/auto-signout/cron', autoSignOutCron);

router.post('/login', login);
router.get('/me', protectEmployee, getMe);
router.post('/checkin', protectEmployee, checkIn);
router.post('/checkout', protectEmployee, checkOut);
router.get('/attendance', protectEmployee, getAttendanceHistory);
router.get('/attendance-calendar', protectEmployee, getAttendanceCalendar);

router.get('/laundry', protectEmployee, getLaundry);
router.post('/laundry', protectEmployee, submitLaundry);

export default router;
