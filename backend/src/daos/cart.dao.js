const { pool } = require('../config/db');

class CartDAO {
    
    async getCartByClientId(clienteId) {
        let query = 'SELECT * FROM carritos WHERE cliente_id = $1';
        let result = await pool.query(query, [clienteId]);

        if (result.rows.length > 0) {
            return result.rows[0];
        } else {
            query = 'INSERT INTO carritos (cliente_id) VALUES ($1) RETURNING *';
            result = await pool.query(query, [clienteId]);
            return result.rows[0];
        }
    }

    async addItem(carritoId, productoId, variante, cantidad) {
        const query = `
            INSERT INTO carrito_items (carrito_id, producto_id, variante, cantidad)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (carrito_id, producto_id, variante) 
            DO UPDATE SET 
                cantidad = carrito_items.cantidad + EXCLUDED.cantidad,
                agregado_en = NOW()
            RETURNING *;
        `;
        const res = await pool.query(query, [carritoId, productoId, variante, cantidad]);
        return res.rows[0];
    }

    async getCartItems(carritoId) {
        const query = `
            SELECT 
                ci.id, 
                ci.cantidad, 
                ci.variante,
                p.nombre, 
                p.precio_base, 
                p.imagen_url,
                p.temporada,
                (p.precio_base * ci.cantidad) as subtotal
            FROM carrito_items ci
            JOIN productos p ON ci.producto_id = p.id
            WHERE ci.carrito_id = $1
              -- [FIX] Prevenir Carrito Fantasma: Ignorar productos con Soft Delete o inactivos
              AND p.deleted_at IS NULL 
              AND p.activo = TRUE
            ORDER BY ci.agregado_en DESC;
        `;
        const res = await pool.query(query, [carritoId]);
        return res.rows;
    }

    async removeItem(itemId, carritoId) {
        const query = 'DELETE FROM carrito_items WHERE id = $1 AND carrito_id = $2 RETURNING *';
        const res = await pool.query(query, [itemId, carritoId]);
        return res.rows[0];
    }

    async clearCart(carritoId) {
        const query = 'DELETE FROM carrito_items WHERE carrito_id = $1';
        await pool.query(query, [carritoId]);
    }

    // Usamos el ID del carrito_item (itemId) para evitar los fallos de comparación de JSON
    async updateItemExactQuantity(itemId, carritoId, nuevaCantidad) {
    const query = `
        UPDATE carrito_items 
        SET cantidad = $1, agregado_en = NOW()
        WHERE id = $2 AND carrito_id = $3
        RETURNING *;
    `;
    const res = await pool.query(query, [nuevaCantidad, itemId, carritoId]);
    return res.rows[0];
    }
}




module.exports = new CartDAO();