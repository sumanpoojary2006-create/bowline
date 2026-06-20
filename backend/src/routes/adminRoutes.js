import { Router } from 'express';
import {
  createPricingRule,
  createCoupon,
  deleteCoupon,
  deletePricingRule,
  downloadDailyGuestReportPdf,
  downloadMonthlyBookingsCsv,
  getCoupons,
  getDailyGuestReport,
  getDashboardOverview,
  getMonthlyAnalytics,
  getPricingRules,
  getUserBookingHistory,
  getUsers,
  sendDailyGuestReportEmailNow,
  updatePricingRule,
  updateCoupon,
} from '../controllers/adminController.js';
import { authorize, protect } from '../middleware/auth.js';
import {
  createChecklistItem,
  createEmployee,
  deleteChecklistItem,
  getAllAttendance,
  getChecklistItems,
  getChecklistSubmissions,
  getEmployees,
  getWifiSetting,
  reorderChecklistItems,
  reviewChecklistSubmission,
  updateChecklistItem,
  updateEmployee,
  updateWifiSetting,
} from '../controllers/adminEmployeeController.js';

const router = Router();

router.use(protect, authorize('admin'));

router.get('/overview', getDashboardOverview);
router.get('/analytics/monthly', getMonthlyAnalytics);
router.get('/analytics/monthly/csv', downloadMonthlyBookingsCsv);
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

router.get('/employees', getEmployees);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);
router.get('/attendance', getAllAttendance);
router.get('/checklists', getChecklistSubmissions);
router.put('/checklists/:id', reviewChecklistSubmission);

// Checklist editor (templates per employee type). `reorder` must be registered
// before the `:id` route so it isn't captured as an id.
router.get('/checklist-items', getChecklistItems);
router.post('/checklist-items', createChecklistItem);
router.put('/checklist-items/reorder', reorderChecklistItems);
router.put('/checklist-items/:id', updateChecklistItem);
router.delete('/checklist-items/:id', deleteChecklistItem);

router.get('/settings/wifi', getWifiSetting);
router.put('/settings/wifi', updateWifiSetting);

export default router;
