import { Router } from 'express';
import { register, login, logout, requestOtp } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';
import { verifyToken } from '../middlewares/authSecurity.js';

const router = Router();
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', verifyToken, logout);
router.post('/otp', authRateLimiter, requestOtp);

export default router;
