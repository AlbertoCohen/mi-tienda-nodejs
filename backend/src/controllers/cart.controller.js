import { pool } from '../config/db.js';
import { catchAsync } from '../utils/catchAsync.js';
import { checkoutAtomic } from '../services/cart.service.js';
import { validatePromoInSession } from '../services/promo.service.js';
import { createCheckoutPreference } from '../services/mercadopago.service.js';

export const getCart = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const sessionId = req.cookies?.tienda_anon_session_id;

  const cartRes = await pool.query(
    `SELECT c.id, c.cupon_id, cp.codigo AS cupon_codigo, cp.valor AS cupon_valor, cp.tipo AS cupon_tipo
     FROM carritos c 
     LEFT JOIN cupones cp ON cp.id = c.cupon_id
     WHERE ${userId ? 'c.usuario_id = $1' : 'c.session_id = $1'}`,
    [userId || sessionId]
  );

  if (cartRes.rows.length === 0) {
    return res.status(200).json({ items: [], subtotal: 0, total: 0 });
  }

  const cart = cartRes.rows[0];
  const itemsRes = await pool.query(
    `SELECT ci.id, ci.variante_id, ci.cantidad, ci.precio_unitario_congelado AS precio_unitario,
            ci.estacion_item, p.nombre, v.talle, v.color, pi.imagen_url
     FROM carrito_items ci
     JOIN variantes v ON v.id = ci.variante_id
     JOIN productos p ON p.id = v.producto_id
     LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id AND pi.es_portada = TRUE
     WHERE ci.carrito_id = $1`,
    [cart.id]
  );

  res.status(200).json({
    cartId: cart.id,
    items: itemsRes.rows,
    coupon: cart.cupon_codigo ? { codigo: cart.cupon_codigo, valor: cart.cupon_valor, tipo: cart.cupon_tipo } : null
  });
});

export const checkout = catchAsync(async (req, res) => {
  const { items, idempotencyKey, datosEnvio, cuponId } = req.body;
  const usuarioId = req.user?.id;

  const result = await checkoutAtomic({
    usuarioId,
    items,
    idempotencyKey,
    datosEnvio,
    cuponId
  });

  const preference = await createCheckoutPreference(
    { id: result.orderId, idempotency_key: idempotencyKey },
    result.validatedLines
  );

  res.status(200).json({
    status: 'success',
    orderId: result.orderId,
    total: result.totalNeto,
    initPoint: preference.init_point
  });
});

export const applyCoupon = catchAsync(async (req, res) => {
  const { carritoId, codigo, sessionToken, isReload } = req.body;
  const result = await validatePromoInSession({ carritoId, codigo, sessionToken, isReload });
  res.status(200).json(result);
});
