import { Router } from 'express';
import multer from 'multer';
import {
  checkAvailability,
  createListing,
  deleteListing,
  getAdminListings,
  getBookedDatesForListing,
  getBookedDatesForListings,
  getListingBySlug,
  getListings,
  getNextAvailableForListing,
  getNextAvailableForListings,
  getRoomsWithAvailability,
  updateListing,
} from '../controllers/listingController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', getListings);
router.get('/admin/all', protect, authorize('admin'), getAdminListings);
router.get('/availability/rooms', getRoomsWithAvailability);
router.get('/availability/booked-dates', getBookedDatesForListings);
router.get('/availability/next-available', getNextAvailableForListings);
router.get('/:id/booked-dates', getBookedDatesForListing);
router.get('/:id/next-available', getNextAvailableForListing);
router.get('/:slug', getListingBySlug);
router.post('/:id/availability', checkAvailability);
router.post('/', protect, authorize('admin'), upload.array('images', 6), createListing);
router.put('/:id', protect, authorize('admin'), upload.array('images', 6), updateListing);
router.delete('/:id', protect, authorize('admin'), deleteListing);

export default router;
