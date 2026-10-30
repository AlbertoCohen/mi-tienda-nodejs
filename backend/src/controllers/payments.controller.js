import { pool } from '../config/db.js';
import { catchAsync } from '../utils/catchAsync.js';
import { verifyMercadoPagoSignature } from '../services/mercadopago.service.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const mpClient = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

export const handleWebhook = catchAsync(async (req, res) => {
  const { data, type } = req.body;
  if (type === 'payment' && data?.id) {
    const paymentId = String(data.id);
    const validSig = verifyMercadoPagoSignature(req.headers, paymentId);
    if (!validSig && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Firma inválida' });
    }

    const logRes = await pool.query(
      `INSERT INTO mercadopago_webhooks_log (payment_id, request_id, topic, payload)
       VALUES ($1, $2, $3, $4) ON CONFLICT (payment_id) DO NOTHING RETURNING id`,
      [paymentId, req.headers['x-request-id'] || null, type, JSON.stringify(req.body)]
    );

    if (logRes.rows.length === 0) {
      return res.status(200).json({ message: 'Ya procesado' });
    }

    const payment = new Payment(mpClient);
    const info = await payment.get({ id: paymentId });
    const orderId = info.external_reference;
    const status = info.status;

    if (status === 'approved') {
      await pool.query(
        `UPDATE ordenes SET estado_pago = 'APROBADO', mercadopago_payment_id = $1, actualizado_en = NOW() WHERE id = $2`,
        [paymentId, orderId]
      );
      // Enqueue in arca_outbox
      const ordRes = await pool.query('SELECT total_neto, email_contacto, datos_envio FROM ordenes WHERE id = $1', [orderId]);
      const ord = ordRes.rows[0];
      const itemsRes = await pool.query('SELECT cantidad, precio_unitario FROM orden_items WHERE orden_id = $1', [orderId]);

      await pool.query(
        `INSERT INTO arca_outbox (orden_id, payload, estado) VALUES ($1, $2, 'PENDING')`,
        [
          orderId,
          JSON.stringify({
            puntoVta: Number(process.env.ARCA_PUNTO_VENTA || 1),
            cbteTipo: 6, // Factura B
            docTipo: 99,
            docNro: 0,
            items: itemsRes.rows
          })
        ]
      );
    } else if (status === 'rejected' || status === 'cancelled') {
      await pool.query(`UPDATE ordenes SET estado_pago = 'RECHAZADO' WHERE id = $1`, [orderId]);
      const items = await pool.query('SELECT variante_id, cantidad FROM orden_items WHERE orden_id = $1', [orderId]);
      for (const it of items.rows) {
        await pool.query('UPDATE variantes SET stock = stock + $1 WHERE id = $2', [it.cantidad, it.variante_id]);
      }
    }

    await pool.query('UPDATE mercadopago_webhooks_log SET procesado = TRUE, procesado_en = NOW() WHERE payment_id = $1', [paymentId]);
    return res.status(200).json({ status: 'PROCESSED' });
  }

  res.status(200).json({ status: 'IGNORED' });
});
