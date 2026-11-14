import { Router } from 'express';
import { sendMonthlyLaundryDamageCron, sendUpcomingCheckinsCron } from '../controllers/reportController.js';

const router = Router();

// Vercel adds `Authorization: Bearer <CRON_SECRET>` to scheduled requests.
router.get('/upcoming-checkins/cron', sendUpcomingCheckinsCron);
router.get('/laundry-damage/cron', sendMonthlyLaundryDamageCron);

export default router;
