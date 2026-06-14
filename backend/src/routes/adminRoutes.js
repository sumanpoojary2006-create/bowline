import { Router } from 'express';
import {
  createPricingRule,
  createCoupon,
  deleteCoupon,
  deletePricingRule,
  downloadDailyGuestReportPdf,
  getCoupons,
  getDailyGuestReport,
  getDashboardOverview,
  getPricingRules,
  getUserBookingHistory,
  getUsers,
  sendDailyGuestReportEmailNow,
  updatePricingRule,
  updateCoupon,
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
router.get('/reports/daily', getDailyGuestReport);
router.get('/reports/daily/pdf', downloadDailyGuestReportPdf);
router.post('/reports/daily/send', sendDailyGuestReportEmailNow);
router.get('/coupons', getCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

export default router;
