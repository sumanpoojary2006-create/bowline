import { Router } from 'express';
import { handleRazorpayWebhook } from '../controllers/razorpayWebhookController.js';

const router = Router();

router.post('/razorpay', handleRazorpayWebhook);

export default router;
