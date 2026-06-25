import { Router } from 'express';
import { authorize, protect } from '../middleware/auth.js';
import {
  getSyncStatus,
  pushToSheet,
  inboundWebhook,
  bookingRowInbound,
  importLegacy,
  getCalendarFeed,
  syncAirbnb,
  syncAirbnbCron,
  getFullHouseAirbnbSetting,
  updateFullHouseAirbnbSetting,
} from '../controllers/syncController.js';

const router = Router();

// Apps Script calls this — authenticated by secret in body, no JWT
router.post('/inbound', inboundWebhook);
router.post('/bookings-inbound', bookingRowInbound);

// Vercel Cron calls this — authenticated by CRON_SECRET bearer token
router.get('/airbnb/cron', syncAirbnbCron);

// Public iCal feed for Airbnb to import
router.get('/calendar/:id', getCalendarFeed);

// Admin-only endpoints
router.get('/status', protect, authorize('admin'), getSyncStatus);
router.post('/push', protect, authorize('admin'), pushToSheet);
router.post('/import-legacy', protect, authorize('admin'), importLegacy);
router.post('/airbnb', protect, authorize('admin'), syncAirbnb);
router.get('/airbnb/full-house-url', protect, authorize('admin'), getFullHouseAirbnbSetting);
router.put('/airbnb/full-house-url', protect, authorize('admin'), updateFullHouseAirbnbSetting);

export default router;
