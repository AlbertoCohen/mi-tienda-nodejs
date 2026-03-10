const { pool } = require('../config/db');
const productDAO = require('../daos/product.dao');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;
const AppError = require('../utils/AppError');

class ProductService {

    async listarProductos(filtros) { return await productDAO.seleccionar(filtros); }
    async obtenerDetalle(id) { return await productDAO.getById(id); }
    async obtenerConfig(clave) { return await productDAO.getConfig(clave); }
    async eliminarProducto(id) { return await productDAO.delete(id); }

    async crearProducto(data, filePath) {
        let imagenUrl = null;
        let imagenPublicId = null;
        
        if (filePath) {
            try {
                const res = await cloudinary.uploader.upload(filePath, { 
                    folder: "tienda_v3_pro",
                    use_filename: true, 
                    transformation: [{ width: 800, crop: "limit" }]
                });
                imagenUrl = res.secure_url;
                imagenPublicId = res.public_id;
                fs.unlink(filePath).catch(() => {}); 
            } catch (err) {
                fs.unlink(filePath).catch(() => {});
                throw new AppError("Error subiendo imagen: " + err.message, 500);
            }
        }

        const client = await pool.connect();

        try {
            await client.query('BEGIN'); 
            
            // [FIX] 1. Pasamos el 'client' al DAO para que respete la transacción
            const nuevoProducto = await productDAO.create(data, imagenUrl, client);

            // [FIX] 2. Procesamiento dinámico de variantes (Reemplaza el hardcodeo)
            // Se espera que el frontend envíe un string JSON en 'variantes' vía FormData
            const variantes = data.variantes ? JSON.parse(data.variantes) : [];
    
            if (variantes.length === 0) {
                throw new AppError("Debe incluir al menos una variante (color/talle)", 400);
            }

            // [FIX] 3. Inserción concurrente del inventario
            const promesasInventario = variantes.map(v => {
                return client.query(`
                    INSERT INTO inventario (producto_id, color, talle, stock)
                    VALUES ($1, $2, $3, $4)
                `, [nuevoProducto.id, v.color, v.talle, parseInt(v.stock, 10) || 0]);
            });

            await Promise.all(promesasInventario);
            await client.query('COMMIT'); 
            return nuevoProducto;

        } catch (dbError) {
            await client.query('ROLLBACK'); 
            if (imagenPublicId) await cloudinary.uploader.destroy(imagenPublicId);
            throw dbError;
        } finally {
            client.release();
        }
    }

    async registrarVenta(datosVenta) {
        const { producto_id, cliente_id, color, talle, cantidad, total } = datosVenta;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Verificar Stock
            const checkStock = `SELECT id, stock FROM inventario WHERE producto_id = $1 AND color = $2 AND talle = $3 FOR UPDATE`;
            const resStock = await client.query(checkStock, [producto_id, color, talle]);

            if (resStock.rows.length === 0) throw new Error("Variante no encontrada");
            if (resStock.rows[0].stock < cantidad) throw new Error("Stock insuficiente");

            // 2. Restar Stock
            await client.query('UPDATE inventario SET stock = stock - $1 WHERE id = $2', [cantidad, resStock.rows[0].id]);

            // 3. Crear Orden
            const resOrden = await client.query(
                `INSERT INTO ordenes (cliente_id, subtotal, total_final, estado) VALUES ($1, $2, $3, 'PAGADO') RETURNING id`, 
                [cliente_id || null, total, total]
            );

            // 4. Crear Item
            const prod = await client.query('SELECT nombre FROM productos WHERE id = $1', [producto_id]);
            await client.query(
                `INSERT INTO orden_items (orden_id, producto_id, nombre_producto_snapshot, variante_snapshot, cantidad, precio_unitario, subtotal_item) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [resOrden.rows[0].id, producto_id, prod.rows[0].nombre, `${color} ${talle}`, cantidad, total/cantidad, total]
            );

            await client.query('COMMIT');
            return { 
                mensaje: "Venta exitosa", 
                orden_id: resOrden.rows[0].id, 
                stock_restante: resStock.rows[0].stock - cantidad 
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new ProductService();