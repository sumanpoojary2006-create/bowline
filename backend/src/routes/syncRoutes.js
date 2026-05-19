import { Router } from 'express';
import { authorize, protect } from '../middleware/auth.js';
import {
  getSyncStatus,
  pushToSheet,
  inboundWebhook,
  importLegacy,
} from '../controllers/syncController.js';

const router = Router();

// Apps Script calls this — authenticated by secret in body, no JWT
router.post('/inbound', inboundWebhook);

// Admin-only endpoints
router.get('/status', protect, authorize('admin'), getSyncStatus);
router.post('/push', protect, authorize('admin'), pushToSheet);
router.post('/import-legacy', protect, authorize('admin'), importLegacy);

export default router;
