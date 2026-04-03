import { Router } from 'express';
import {
  getMyNotifications,
  markNotificationRead,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);
router.get('/', getMyNotifications);
router.patch('/:id/read', markNotificationRead);

export default router;
