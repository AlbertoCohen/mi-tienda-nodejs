const { query } = require('../config/database');
const { createPreference, verifyWebhookSignature, processPaymentNotification } = require('../services/mercadopago.service');
const { emitInvoiceForOrder } = require('../services/arca.service');
const { calculatePromotionDiscount } = require('../../../shared/domainEngine');

async function initiateCheckout(req, res) {
  try {
    const userId = req.user ? req.user.sub : null;
    const { cartId, shippingAddress, shippingCost = 0, appliedPromoCode, needsInvoice = false, fiscalData = {} } = req.body;

    const itemsRes = await query(`
      SELECT ci.product_variant_id AS "variantId", ci.quantity, ci.unit_price AS "unitPrice",
             p.name AS "productName", p.target_gender, pv.size, pv.color, c.name AS "categoryName"
      FROM cart_items ci
      JOIN product_variants pv ON pv.id = ci.product_variant_id
      JOIN products p ON p.id = pv.product_id
      JOIN categories c ON c.id = p.category_id
      WHERE ci.cart_id = $1
    `, [cartId]);

    if (itemsRes.rowCount === 0) return res.status(400).json({ error: 'Carrito vacío.' });

    const subtotal = itemsRes.rows.reduce((sum, i) => sum + (parseFloat(i.unitPrice) * i.quantity), 0);
    let discount = 0;

    if (appliedPromoCode) {
      const pRes = await query(`SELECT * FROM promotions WHERE code = $1 AND is_active = TRUE`, [appliedPromoCode.toUpperCase().trim()]);
      if (pRes.rowCount > 0) {
        const evalPromo = calculatePromotionDiscount({ promo: pRes.rows[0], items: itemsRes.rows, subtotal });
        discount = evalPromo.discountAmount;
      }
    }

    const total = Math.max(0, subtotal - discount + parseFloat(shippingCost));
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();

    const orderRes = await query(`
      INSERT INTO orders (order_number, user_id, cart_id, status, subtotal, discount_total, shipping_total, total, shipping_address)
      VALUES ($1, $2, $3, 'pending_payment', $4, $5, $6, $7, $8) RETURNING id, order_number, total;
    `, [orderNumber, userId, cartId, subtotal.toFixed(2), discount.toFixed(2), parseFloat(shippingCost).toFixed(2), total.toFixed(2), JSON.stringify(shippingAddress || {})]);

    const order = orderRes.rows[0];
    for (const item of itemsRes.rows) {
      await query(`
        INSERT INTO order_items (order_id, product_variant_id, quantity, unit_price, line_total)
        VALUES ($1, $2, $3, $4, $5)
      `, [order.id, item.variantId, item.quantity, item.unitPrice, (item.unitPrice * item.quantity).toFixed(2)]);
    }

    if (needsInvoice) {
      await query(`
        INSERT INTO fiscal_invoices (order_id, is_requested_by_client, doc_number, arca_status, pos_number)
        VALUES ($1, TRUE, $2, 'PENDING', 1)
      `, [order.id, fiscalData.cuitOrDni || '00000000']);
    }

    const mp = await createPreference({
      orderId: order.id,
      orderNumber: order.order_number,
      items: itemsRes.rows,
      payer: { email: shippingAddress?.email || 'cliente@moda.com', firstName: shippingAddress?.firstName || 'Cliente' },
      discountAmount: discount,
      shippingAmount: shippingCost
    });

    return res.status(201).json({ orderId: order.id, orderNumber: order.order_number, total: order.total, checkoutUrl: mp.initPoint });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleMercadoPagoWebhook(req, res) {
  try {
    const paymentId = req.body?.data?.id || req.query['data.id'] || 12345;
    const result = await processPaymentNotification(paymentId);

    if (result.status === 'SUCCESS_APPROVED' && result.orderId) {
      const inv = await query(`SELECT is_requested_by_client, doc_number FROM fiscal_invoices WHERE order_id = $1`, [result.orderId]);
      if (inv.rows[0]?.is_requested_by_client) {
        emitInvoiceForOrder({
          orderId: result.orderId,
          customerData: { docNumber: inv.rows[0].doc_number, taxCondition: 'Consumidor Final' },
          totalAmount: 50000
        }).catch(e => console.error('[ARCA_FAIL]', e.message));
      }
    }
    return res.status(200).json({ status: 'PROCESSED' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getOrderInvoice(req, res) {
  try {
    const inv = await query(`SELECT * FROM fiscal_invoices WHERE order_id = $1`, [req.params.orderId]);
    if (inv.rowCount === 0) return res.status(404).json({ error: 'Comprobante no hallado.' });
    return res.status(200).json(inv.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { initiateCheckout, handleMercadoPagoWebhook, getOrderInvoice };
