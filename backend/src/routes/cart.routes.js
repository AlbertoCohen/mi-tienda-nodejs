import { Router } from 'express';
import { getCart, checkout, applyCoupon } from '../controllers/cart.controller.js';

const router = Router();
router.get('/', getCart);
router.post('/checkout', checkout);
router.post('/cupon', applyCoupon);

export default router;
