import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import crypto from 'crypto';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

export const createCheckoutPreference = async (orden, items) => {
  const preference = new Preference(client);
  const resp = await preference.create({
    body: {
      items: items.map(it => ({
        id: it.variante_id,
        title: `${it.producto_nombre} - ${it.variante_info}`,
        quantity: it.cantidad,
        unit_price: Number(it.precio_unitario),
        currency_id: 'ARS'
      })),
      external_reference: orden.id,
      notification_url: `${process.env.APP_PUBLIC_URL}/api/pagos/webhook`,
      back_urls: {
        success: `${process.env.APP_PUBLIC_URL}/checkout/exito`,
        pending: `${process.env.APP_PUBLIC_URL}/checkout/pendiente`,
        failure: `${process.env.APP_PUBLIC_URL}/checkout/error`
      },
      auto_return: 'approved',
      binary_mode: true
    },
    requestOptions: {
      idempotencyKey: String(orden.idempotency_key)
    }
  });

  return resp;
};

export const verifyMercadoPagoSignature = (headers, dataId) => {
  const xSignature = headers['x-signature'];
  const xRequestId = headers['x-request-id'];
  if (!xSignature || !xRequestId) return false;

  const parts = xSignature.split(',');
  let ts = null;
  let hashV1 = null;

  for (const p of parts) {
    const [k, v] = p.split('=');
    if (k?.trim() === 'ts') ts = v?.trim();
    if (k?.trim() === 'v1') hashV1 = v?.trim();
  }

  if (!ts || !hashV1) return false;

  // 300s window protection
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - Number(ts)) > 300) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computedHash = crypto
    .createHmac('sha256', process.env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');

  const bufA = crypto.createHash('sha256').update(computedHash).digest();
  const bufB = crypto.createHash('sha256').update(hashV1).digest();

  return crypto.timingSafeEqual(bufA, bufB) && computedHash.length === hashV1.length;
};
