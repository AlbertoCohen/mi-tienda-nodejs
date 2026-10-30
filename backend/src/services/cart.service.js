import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export const checkoutAtomic = async ({ usuarioId, items, idempotencyKey, datosEnvio, cuponId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock user cart header to prevent multi-tab duplicate checkout
    if (usuarioId) {
      await client.query('SELECT id FROM carritos WHERE usuario_id = $1 FOR UPDATE', [usuarioId]);
    }

    // 2. Sort variants lexicographically to eliminate 40P01 deadlocks
    const sortedItems = [...items].sort((a, b) => a.variante_id.localeCompare(b.variante_id));
    const variantIds = sortedItems.map(it => it.variante_id);

    const stockRes = await client.query(
      `SELECT v.id, v.stock, p.precio_base, p.precio_promocional, p.nombre, p.estacion
       FROM variantes v 
       JOIN productos p ON p.id = v.producto_id 
       WHERE v.id = ANY($1::uuid[]) AND v.eliminado_en IS NULL AND p.eliminado_en IS NULL
       ORDER BY v.id ASC FOR UPDATE`,
      [variantIds]
    );

    const stockMap = new Map(stockRes.rows.map(r => [r.id, r]));

    let calculatedSubtotal = 0;
    const validatedLines = [];

    for (const line of sortedItems) {
      const dbItem = stockMap.get(line.variante_id);
      if (!dbItem || dbItem.stock < line.cantidad) {
        throw new AppError(`Stock insuficiente para la prenda ${dbItem?.nombre || line.variante_id}. Disponible: ${dbItem?.stock || 0}`, 409);
      }

      const unitPrice = Number(dbItem.precio_promocional || dbItem.precio_base);
      const lineSubtotal = Math.round(unitPrice * line.cantidad * 100) / 100;
      calculatedSubtotal += lineSubtotal;

      validatedLines.push({
        variante_id: line.variante_id,
        producto_nombre: dbItem.nombre,
        variante_info: line.variante_info || 'Estándar',
        cantidad: line.cantidad,
        precio_unitario: unitPrice,
        subtotal: lineSubtotal,
        estacion_item: dbItem.estacion,
        precio_base_original: Number(dbItem.precio_base),
        descuento_promo_unitario: Number(dbItem.precio_base) - unitPrice,
        descuento_cupon_unitario: 0.00
      });
    }

    let discountTotal = 0;
    if (cuponId) {
      const cupRes = await client.query('SELECT * FROM cupones WHERE id = $1 AND activo = TRUE FOR UPDATE', [cuponId]);
      if (cupRes.rows.length > 0) {
        const cup = cupRes.rows[0];
        if (cup.limite_usos && cup.usos_actuales >= cup.limite_usos) {
          throw new AppError('El cupón ha alcanzado el límite máximo de usos.', 400);
        }
        discountTotal = cup.tipo === 'PORCENTAJE' 
          ? Math.round(calculatedSubtotal * (Number(cup.valor) / 100) * 100) / 100
          : Math.min(Number(cup.valor), calculatedSubtotal);

        await client.query('UPDATE cupones SET usos_actuales = usos_actuales + 1 WHERE id = $1', [cuponId]);
      }
    }

    const shipping = calculatedSubtotal >= 150000 ? 0.00 : 8500.00;
    const totalNeto = Math.round((calculatedSubtotal - discountTotal + shipping) * 100) / 100;

    // Decrement stock
    for (const line of validatedLines) {
      await client.query('UPDATE variantes SET stock = stock - $1 WHERE id = $2', [line.cantidad, line.variante_id]);
    }

    // Insert order
    const orderRes = await client.query(
      `INSERT INTO ordenes 
       (idempotency_key, usuario_id, email_contacto, telefono_contacto, subtotal_bruto, monto_descuento, costo_envio, total_neto, datos_envio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        idempotencyKey, usuarioId || null, datosEnvio.email, datosEnvio.telefono || null,
        calculatedSubtotal, discountTotal, shipping, totalNeto, JSON.stringify(datosEnvio)
      ]
    );
    const orderId = orderRes.rows[0].id;

    for (const vl of validatedLines) {
      await client.query(
        `INSERT INTO orden_items 
         (orden_id, variante_id, producto_nombre, variante_info, cantidad, precio_unitario, subtotal, estacion_item, precio_base_original, descuento_promo_unitario, descuento_cupon_unitario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [orderId, vl.variante_id, vl.producto_nombre, vl.variante_info, vl.cantidad, vl.precio_unitario, vl.subtotal, vl.estacion_item, vl.precio_base_original, vl.descuento_promo_unitario, vl.descuento_cupon_unitario]
      );
    }

    // Clear cart items atomically
    if (usuarioId) {
      await client.query('DELETE FROM carrito_items WHERE carrito_id = (SELECT id FROM carritos WHERE usuario_id = $1)', [usuarioId]);
    }

    await client.query('COMMIT');
    return { orderId, totalNeto, validatedLines };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
