// src/services/product.service.js
//Aquí conectamos Cloudinary y aseguramos las ventas.
const { pool } = require('../config/db'); // Importamos POOL para transacciones
const productDAO = require('../daos/product.dao');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const AppError = require('../utils/AppError');

class ProductService {

    async listarProductos(filtros) {
        return await productDAO.seleccionar(filtros);
    }

    async obtenerDetalle(id) {
        return await productDAO.getById(id);
    }

    async crearProducto(data, filePath) {
        let imagenUrl = null;
        
        // Subida de imagen a Cloudinary
        if (filePath) {
            try {
                const res = await cloudinary.uploader.upload(filePath, { 
                    folder: "tienda_v3_pro",
                    transformation: [{ width: 800, crop: "limit" }] // Optimización de imagen
                });
                imagenUrl = res.secure_url;
                
                // Borramos el archivo temporal del servidor
                try { fs.unlinkSync(filePath); } catch (e) { console.error("Error borrando tmp:", e); }

            } catch (error) {
                console.error("Error Cloudinary:", error);
                throw new AppError("Fallo al subir imagen a la nube", 500);
            }
        }
        return await productDAO.create(data, imagenUrl);
    }

    async eliminarProducto(id) {
        const borrado = await productDAO.delete(id);
        if (!borrado) throw new AppError("Producto no encontrado o ya eliminado", 404);
        return borrado;
    }

    /**
     * --- TRANSACCIÓN ACID DE VENTA ---
     * Garantiza integridad entre dinero y stock.
     */
    async registrarVenta(ventaData) {
        const client = await pool.connect(); // Pedimos un cliente exclusivo del pool
        
        try {
            await client.query('BEGIN'); // 1. INICIAR TRANSACCIÓN

            // Paso A: Restar Stock Atomico
            // La condición "AND stock >= $1" actúa como bloqueo de seguridad
            const updateStock = `
                UPDATE inventario 
                SET stock = stock - $1 
                WHERE producto_id = $2 AND color = $3 AND talle = $4 AND stock >= $1
                RETURNING id
            `;
            const resUpdate = await client.query(updateStock, [
                ventaData.cantidad, ventaData.producto_id, ventaData.color, ventaData.talle
            ]);

            if (resUpdate.rowCount === 0) {
                throw new AppError("Stock insuficiente o variante no encontrada", 409); // 409 Conflict
            }

            // Paso B: Guardar Registro de Venta
            const insertVenta = `
                INSERT INTO ventas (producto_id, detalle_variante, cantidad, precio_final)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            const detalle = `${ventaData.color} ${ventaData.talle}`;
            
            const resVenta = await client.query(insertVenta, [
                ventaData.producto_id, detalle, ventaData.cantidad, ventaData.total
            ]);

            await client.query('COMMIT'); // 2. CONFIRMAR (Si llegamos aquí, todo es perfecto)
            return resVenta.rows[0];

        } catch (error) {
            await client.query('ROLLBACK'); // 3. DESHACER (Si algo falló, el stock vuelve atrás)
            throw error; // Re-lanzamos el error para que el controller lo vea
        } finally {
            client.release(); // Liberar cliente al pool
        }
    }

    async obtenerConfig(clave) {
        return await productDAO.getConfig(clave);
    }
}

module.exports = new ProductService();