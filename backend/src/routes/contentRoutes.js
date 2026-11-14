import { Router } from 'express';
import { getPublicFaqs } from '../controllers/faqController.js';

const router = Router();

router.get('/faqs', getPublicFaqs);

export default router;

