import { Router } from 'express';
import {
  createPricingRule,
  deletePricingRule,
  getDashboardOverview,
  getPricingRules,
  getUserBookingHistory,
  getUsers,
  updatePricingRule,
} from '../controllers/adminController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();

router.use(protect, authorize('admin'));

router.get('/overview', getDashboardOverview);
router.get('/users', getUsers);
router.get('/users/:id/bookings', getUserBookingHistory);
router.get('/pricing-rules', getPricingRules);
router.post('/pricing-rules', createPricingRule);
router.put('/pricing-rules/:id', updatePricingRule);
router.delete('/pricing-rules/:id', deletePricingRule);

export default router;
