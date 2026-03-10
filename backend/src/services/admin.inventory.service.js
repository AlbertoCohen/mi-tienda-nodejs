// src/services/admin.inventory.service.js (Versión Blindada)
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');

class AdminInventoryService {
    
    // --- MÉTODO 1: AJUSTE RELATIVO (Blindado) ---
    async ajustarStockRelativo(inventarioId, cantidadAjuste, adminId = 1, motivo = 'Ajuste manual') {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 1. UPDATE atómico con validación de estado padre y matemáticas estrictas
            const queryUpdate = `
                UPDATE inventario i
                SET stock = stock + $1
                WHERE i.id = $2 
                  AND (i.stock + $1) >= 0 -- [FIX 1] Bloquea números negativos a nivel SQL
                  AND EXISTS (
                      SELECT 1 FROM productos p 
                      WHERE p.id = i.producto_id 
                        AND p.deleted_at IS NULL -- [FIX 2] Previene inyección en productos borrados
                        AND p.activo = TRUE
                  )
                RETURNING i.id, i.stock, i.producto_id;
            `;
            const resUpdate = await client.query(queryUpdate, [cantidadAjuste, inventarioId]);

            if (resUpdate.rows.length === 0) {
                throw new AppError("Inventario no encontrado, producto inactivo, o la resta dejaría el stock en negativo.", 400);
            }

            // [FIX 4] Registro de Auditoría (Ledger)
            await client.query(`
                INSERT INTO movimientos_inventario (inventario_id, producto_id, cantidad, tipo_movimiento, admin_id, motivo)
                VALUES ($1, $2, $3, 'AJUSTE_RELATIVO', $4, $5)
            `, [inventarioId, resUpdate.rows[0].producto_id, cantidadAjuste, adminId, motivo]);

            await client.query('COMMIT');
            return resUpdate.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // --- MÉTODO 2: SETEO ABSOLUTO (Blindado) ---
    async setearStockAbsoluto(inventarioId, nuevoStockFijo, adminId = 1, motivo = 'Conteo físico') {
        // [FIX 1] Validación de entrada temprana
        if (nuevoStockFijo < 0) throw new AppError("El stock no puede ser negativo", 400);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // [FIX 2] SELECT FOR UPDATE verificando el estado del producto
            // Usamos 'FOR UPDATE OF i' para bloquear solo la fila de inventario y no la de producto
            const queryCheck = `
                SELECT i.id, i.stock, i.producto_id 
                FROM inventario i
                JOIN productos p ON i.producto_id = p.id
                WHERE i.id = $1 
                  AND p.deleted_at IS NULL 
                  AND p.activo = TRUE
                FOR UPDATE OF i; 
            `;
            const check = await client.query(queryCheck, [inventarioId]);

            if (check.rows.length === 0) {
                throw new AppError("Inventario no encontrado o el producto está inactivo/eliminado.", 404);
            }

            const stockAnterior = check.rows[0].stock;
            const diferencia = nuevoStockFijo - stockAnterior; // Calculamos la diferencia para la auditoría

            // Actualizamos
            const resUpdate = await client.query(
                'UPDATE inventario SET stock = $1 WHERE id = $2 RETURNING stock',
                [nuevoStockFijo, inventarioId]
            );

            // [FIX 4] Registro de Auditoría (Ledger)
            if (diferencia !== 0) {
                await client.query(`
                    INSERT INTO movimientos_inventario (inventario_id, producto_id, cantidad, tipo_movimiento, admin_id, motivo)
                    VALUES ($1, $2, $3, 'SETEO_ABSOLUTO', $4, $5)
                `, [inventarioId, check.rows[0].producto_id, diferencia, adminId, motivo]);
            }

            await client.query('COMMIT');
            return resUpdate.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new AdminInventoryService();