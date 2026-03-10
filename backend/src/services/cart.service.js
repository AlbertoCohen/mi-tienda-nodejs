// src/services/cart.service.js (Fragmento corregido)
const { pool } = require('../config/db');
const CartDAO = require('../daos/cart.dao');
const AppError = require('../utils/AppError');

class CartService {
    async procesarCompra(clienteId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN'); // 🔒 INICIO TRANSACCIÓN (Movido arriba)

            // 1. Obtener carrito e ítems (Idealmente pasando el 'client' transaccional al DAO)
            const carrito = await CartDAO.getCartByClientId(clienteId);
            const items = await CartDAO.getCartItems(carrito.id);

            if (items.length === 0) {
                throw new AppError("El carrito está vacío", 400);
            }

            // [FIX] Prevenir Deadlocks ordenando por producto_id de menor a mayor
            items.sort((a, b) => a.producto_id - b.producto_id);

            let totalOrden = 0;
            const itemsProcesados = []; // Guardamos la metadata para el segundo bucle

            // 2. Calcular total y validar stock específico
            for (const item of items) {
                totalOrden += Number(item.subtotal);
                
                // Parseamos la variante (Asumiendo que se guardó como string JSON)
                const varianteObj = typeof item.variante === 'string' ? JSON.parse(item.variante) : item.variante;

                // [FIX] Búsqueda exacta de la variante, sin LIMIT 1
                const resStock = await client.query(
                    `SELECT id, stock FROM inventario 
                     WHERE producto_id = $1 AND color = $2 AND talle = $3 
                     FOR UPDATE`,
                    [item.producto_id, varianteObj.color, varianteObj.talle]
                );

                if (resStock.rows.length === 0) {
                    throw new AppError(`Variante no encontrada para: ${item.nombre}`, 404);
                }

                const inventarioItem = resStock.rows[0];

                if (inventarioItem.stock < item.cantidad) {
                    throw new AppError(`Stock insuficiente para: ${item.nombre} (Talle: ${varianteObj.talle})`, 409);
                }

                // Guardamos el ID exacto del inventario para actualizarlo luego de forma segura
                itemsProcesados.push({
                    ...item,
                    inventario_id: inventarioItem.id,
                    variante_snapshot: `${varianteObj.color} - ${varianteObj.talle}`
                });
            }

            // 3. Crear la Orden
            const resOrden = await client.query(
                `INSERT INTO ordenes (cliente_id, subtotal, total_final, estado) 
                 VALUES ($1, $2, $3, 'PAGADO') RETURNING id`,
                [clienteId, totalOrden, totalOrden]
            );
            const ordenId = resOrden.rows[0].id;

            // 4. Procesar Items de forma directa
            for (const item of itemsProcesados) {
                // [FIX] Update directo por el ID de inventario bloqueado
                await client.query(
                    `UPDATE inventario SET stock = stock - $1 WHERE id = $2`,
                    [item.cantidad, item.inventario_id]
                );

                await client.query(
                    `INSERT INTO orden_items (orden_id, producto_id, nombre_producto_snapshot, variante_snapshot, cantidad, precio_unitario, subtotal_item)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [ordenId, item.producto_id, item.nombre, item.variante_snapshot, item.cantidad, item.precio_base, item.subtotal]
                );
            }

            // 5. Vaciar el Carrito
            await client.query('DELETE FROM carrito_items WHERE carrito_id = $1', [carrito.id]);

            await client.query('COMMIT'); 
            return { orden_id: ordenId, total: totalOrden, items_procesados: items.length };

        } catch (error) {
            // Validamos que el cliente siga vivo antes de intentar rollback
            if (client) await client.query('ROLLBACK').catch(() => {}); 
            throw error;
        } finally {
            if (client) client.release();
        }
    }
}
module.exports = new CartService();