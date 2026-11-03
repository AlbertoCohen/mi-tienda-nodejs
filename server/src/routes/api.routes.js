const express = require('express');
const router = express.Router();
const { authRateLimiter, sanitizeInput, verifyResourceOwnership, sanitizeTrackingNumber, secureErrorHandler } = require('../middleware/security');
const { register, login, elevateRole, mergeAndGetCart, authenticateToken } = require('../controllers/authAndCart.controller');
const { initiateCheckout, handleMercadoPagoWebhook, getOrderInvoice } = require('../controllers/fintech.controller');
const { quoteShipping, dispatchOrderShipment, printLabel } = require('../controllers/logistics.controller');
const { query } = require('../config/database');

router.use(sanitizeInput);

router.post('/auth/register', register);
router.post('/auth/login', authRateLimiter, login);
router.patch('/admin/elevate-role', authenticateToken(true), elevateRole);

router.post('/cart/sync', authenticateToken(false), mergeAndGetCart);
router.get('/cart', authenticateToken(false), (req, res) => {
  req.body.itemsToAdd = [];
  req.body.sessionToken = req.query.sessionToken;
  return mergeAndGetCart(req, res);
});

router.get('/taxonomy/menu', async (req, res, next) => {
  try {
    const s = req.query.season;
    let sql = 'SELECT * FROM v_dynamic_menu';
    const params = [];
    if (s === 'Invierno' || s === 'Verano') {
      sql += ' WHERE category_season = $1 OR category_season = \'Ambas\'';
      params.push(s);
    }
    sql += ' ORDER BY category_name ASC';
    const r = await query(sql, params);
    return res.status(200).json({ categories: r.rows });
  } catch (e) { next(e); }
});

router.post('/fintech/checkout', authenticateToken(false), initiateCheckout);
router.post('/fintech/mercadopago/webhook', handleMercadoPagoWebhook);
router.get('/fintech/invoice/:orderId', authenticateToken(true), verifyResourceOwnership('fiscal_invoices', 'orderId'), getOrderInvoice);

router.post('/logistics/quote', quoteShipping);
router.post('/logistics/dispatch', authenticateToken(true), dispatchOrderShipment);
router.get('/logistics/print/:trackingNumber', (req, res, next) => {
  req.params.trackingNumber = sanitizeTrackingNumber(req.params.trackingNumber);
  return printLabel(req, res);
});

router.use(secureErrorHandler);

module.exports = router;
