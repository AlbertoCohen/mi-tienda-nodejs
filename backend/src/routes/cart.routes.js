const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cart.controller');
const validate = require('../middlewares/validator');
const { cartItemSchema } = require('../utils/schemas');

router.get('/', CartController.getCart);

router.post('/agregar', 
    validate(cartItemSchema), 
    CartController.addToCart
);

router.post('/checkout', CartController.checkoutCart);

module.exports = router;