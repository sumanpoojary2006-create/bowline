import { Router } from 'express';
import {
  cancelMyBooking,
  createAdminManualRoomBooking,
  createBooking,
  getAllBookings,
  getMyBookings,
  updateBookingStatus,
} from '../controllers/bookingController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.post('/', protect, createBooking);
router.get('/me', protect, getMyBookings);
router.patch('/me/:id/cancel', protect, cancelMyBooking);
router.get('/admin/all', protect, authorize('admin'), getAllBookings);
router.post('/admin/manual-room', protect, authorize('admin'), createAdminManualRoomBooking);
router.patch('/admin/:id', protect, authorize('admin'), updateBookingStatus);

export default router;
