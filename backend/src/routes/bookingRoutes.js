import { Router } from 'express';
import {
  cancelGuestBooking,
  cancelMyBooking,
  confirmReschedule,
  createAdminManualRoomBooking,
  createBooking,
  createMultiBooking,
  createRescheduleFeeOrder,
  getBookingPublic,
  getCalendarBookings,
  getAllBookings,
  getMyBookings,
  getRescheduleQuote,
  lookupBookings,
  updateBookingStatus,
  validateCoupon,
} from '../controllers/bookingController.js';
import { authorize, optionalAuth, protect } from '../middleware/auth.js';

const router = Router();

router.post('/', optionalAuth, createBooking);
router.post('/multi', optionalAuth, createMultiBooking);
router.post('/coupon/validate', optionalAuth, validateCoupon);
router.get('/me', protect, getMyBookings);
router.patch('/me/:id/cancel', protect, cancelMyBooking);

router.post('/lookup', lookupBookings);
router.get('/:id/public', getBookingPublic);
router.patch('/:id/cancel', cancelGuestBooking);
router.post('/:id/reschedule/quote', getRescheduleQuote);
router.post('/:id/reschedule/fee-order', createRescheduleFeeOrder);
router.patch('/:id/reschedule', confirmReschedule);

router.get('/admin/all', protect, authorize('admin'), getAllBookings);
router.get('/admin/calendar', protect, authorize('admin'), getCalendarBookings);
router.post('/admin/manual-room', protect, authorize('admin'), createAdminManualRoomBooking);
router.patch('/admin/:id', protect, authorize('admin'), updateBookingStatus);

export default router;
