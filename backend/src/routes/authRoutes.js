import { Router } from 'express';
import {
  getCurrentUser,
  googleLogin,
  login,
  updateProfile,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', protect, getCurrentUser);
router.put('/profile', protect, updateProfile);

export default router;
