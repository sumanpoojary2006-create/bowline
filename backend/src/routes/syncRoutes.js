import { Router } from 'express';
import { authorize, protect } from '../middleware/auth.js';
import {
  getSyncStatus,
  setupSheets,
  pushToSheet,
  pullFromSheet,
  inboundWebhook,
  importLegacy,
} from '../controllers/syncController.js';

const router = Router();

// Apps Script calls this — authenticated by x-sync-secret header, no JWT
router.post('/inbound', inboundWebhook);

// Admin-only endpoints
router.get('/status', protect, authorize('admin'), getSyncStatus);
router.post('/import-legacy', protect, authorize('admin'), importLegacy);
router.post('/setup', protect, authorize('admin'), setupSheets);
router.post('/push', protect, authorize('admin'), pushToSheet);
router.post('/pull', protect, authorize('admin'), pullFromSheet);

export default router;
