import { Router } from 'express';
import { receiveWebhook, verifyWebhook } from '../controllers/whatsappController.js';

const router = Router();

router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

export default router;
