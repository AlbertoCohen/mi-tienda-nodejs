import { pool } from '../config/db.js';
import crypto from 'crypto';

export const validatePromoInSession = async ({ carritoId, codigo, sessionToken, isReload }) => {
  const res = await pool.query('SELECT * FROM cupones WHERE LOWER(codigo) = LOWER($1) AND activo = TRUE', [codigo]);
  if (res.rows.length === 0) {
    return { valid: false, reason: 'Cupón inexistente o inactivo.' };
  }

  const coupon = res.rows[0];
  const now = new Date();
  const expired = now > new Date(coupon.valido_hasta);

  const cartRes = await pool.query('SELECT session_lock_token, session_lock_heartbeat FROM carritos WHERE id = $1', [carritoId]);
  const cart = cartRes.rows[0] || {};

  if (expired) {
    const isRecent = cart.session_lock_heartbeat && (now.getTime() - new Date(cart.session_lock_heartbeat).getTime() < 60000);
    if (isReload || !isRecent || cart.session_lock_token !== sessionToken) {
      await pool.query('UPDATE carritos SET cupon_id = NULL, session_lock_token = NULL WHERE id = $1', [carritoId]);
      return { valid: false, purged: true, reason: 'El cupón ha vencido y fue removido de su pedido.' };
    }
  }

  const lock = sessionToken || crypto.randomBytes(16).toString('hex');
  await pool.query(
    'UPDATE carritos SET cupon_id = $1, session_lock_token = $2, session_lock_heartbeat = NOW() WHERE id = $3',
    [coupon.id, lock, carritoId]
  );

  return { valid: true, coupon, sessionLockToken: lock };
};
