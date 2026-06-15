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
} from '../controllers/syncController.js';

const router = Router();

// Apps Script calls this — authenticated by secret in body, no JWT
router.post('/inbound', inboundWebhook);
router.post('/bookings-inbound', bookingRowInbound);

// Public iCal feed for Airbnb to import
router.get('/calendar/:id', getCalendarFeed);

// Admin-only endpoints
router.get('/status', protect, authorize('admin'), getSyncStatus);
router.post('/push', protect, authorize('admin'), pushToSheet);
router.post('/import-legacy', protect, authorize('admin'), importLegacy);
router.post('/airbnb', protect, authorize('admin'), syncAirbnb);

export default router;
