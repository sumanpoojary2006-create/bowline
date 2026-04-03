import { Router } from 'express';
import multer from 'multer';
import {
  checkAvailability,
  createListing,
  deleteListing,
  getAdminListings,
  getListingBySlug,
  getListings,
  updateListing,
} from '../controllers/listingController.js';
import { authorize, protect } from '../middleware/auth.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', getListings);
router.get('/admin/all', protect, authorize('admin'), getAdminListings);
router.get('/:slug', getListingBySlug);
router.post('/:id/availability', checkAvailability);
router.post('/', protect, authorize('admin'), upload.array('images', 6), createListing);
router.put('/:id', protect, authorize('admin'), upload.array('images', 6), updateListing);
router.delete('/:id', protect, authorize('admin'), deleteListing);

export default router;
