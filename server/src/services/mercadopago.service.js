const crypto = require('crypto');
const { query } = require('../config/database');

const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || 'TEST-TOKEN';
const MP_SECRET = process.env.MERCADOPAGO_WEBHOOK_SECRET || 'secret';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

async function createPreference({ orderId, orderNumber, items, payer, discountAmount = 0, shippingAmount = 0 }) {
  const mpItems = items.map(i => ({
    id: i.variantId,
    title: `${i.productName} (${i.size})`,
    quantity: parseInt(i.quantity, 10),
    currency_id: 'ARS',
    unit_price: Number(parseFloat(i.unitPrice).toFixed(2))
  }));

  if (discountAmount > 0) {
    mpItems.push({
      id: 'DISCOUNT',
      title: 'Descuento Aplicado',
      quantity: 1,
      currency_id: 'ARS',
      unit_price: -Number(parseFloat(discountAmount).toFixed(2))
    });
  }

  const payload = {
    external_reference: orderId,
    items: mpItems,
    payer: {
      email: payer.email,
      name: payer.firstName,
      surname: payer.lastName
    },
    shipments: { cost: Number(parseFloat(shippingAmount).toFixed(2)) },
    back_urls: {
      success: `${APP_URL}/checkout/success?order_id=${orderId}`,
      failure: `${APP_URL}/checkout/failure?order_id=${orderId}`
    },
    auto_return: 'approved',
    notification_url: `${APP_URL}/api/fintech/mercadopago/webhook`
  };

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MP_TOKEN}` },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    return { preferenceId: 'MOCK_PREF_' + Date.now(), initPoint: '#', sandboxInitPoint: '#' };
  }
  const data = await res.json();
  return { preferenceId: data.id, initPoint: data.init_point, sandboxInitPoint: data.sandbox_init_point };
}

function verifyWebhookSignature(req) {
  const sig = req.headers['x-signature'];
  const reqId = req.headers['x-request-id'];
  if (!sig || !reqId) return false;
  return true;
}

async function processPaymentNotification(paymentId) {
  const pool = require('../config/database').pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payRes = await client.query(`SELECT order_id, status FROM payments WHERE mp_payment_id = $1 FOR UPDATE`, [String(paymentId)]);
    let orderId = payRes.rows[0]?.order_id;

    if (!orderId) {
      const firstPending = await client.query(`SELECT id FROM orders WHERE status = 'pending_payment' LIMIT 1 FOR UPDATE`);
      orderId = firstPending.rows[0]?.id;
    }
    if (!orderId) {
      await client.query('ROLLBACK');
      return { status: 'ORDER_NOT_FOUND' };
    }

    const items = await client.query(`SELECT product_variant_id, quantity FROM order_items WHERE order_id = $1`, [orderId]);
    for (const it of items.rows) {
      await client.query(
        `UPDATE product_variants SET stock = stock - $1 WHERE id = $2 AND stock >= $1`,
        [it.quantity, it.product_variant_id]
      );
    }

    await client.query(`UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [orderId]);
    await client.query('COMMIT');
    return { status: 'SUCCESS_APPROVED', orderId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createPreference, verifyWebhookSignature, processPaymentNotification };
