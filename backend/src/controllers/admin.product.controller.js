const catchAsync = require('../utils/catchAsync');
const { pool } = require('../config/db');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;
const AppError = require('../utils/AppError');

// ============================================================================
// 1. CREAR PRODUCTO (Zero-Dependency & Pool Direct)
// ============================================================================
const createProduct = catchAsync(async (req, res, next) => {
    const data = req.body;
    const filePath = req.file ? req.file.path : null;
    let newImageUrl = null;

    try {
        // A. Lógica de Cloudinary (Estrictamente ANTES de la DB)
        if (filePath) {
            const resCloud = await cloudinary.uploader.upload(filePath, { 
                folder: "tienda_v3_pro",
                use_filename: true, 
                transformation: [{ width: 800, crop: "limit" }]
            });
            newImageUrl = resCloud.secure_url;
            
            // Limpieza del archivo temporal en el disco de Render
            await fs.unlink(filePath).catch(() => {});
        }

        // B. Inserción en PostgreSQL usando pool (Sin variables client)
        const atributos = data.atributos ? JSON.stringify(data.atributos) : '{}';

        const insertQuery = `
            INSERT INTO productos (nombre, precio_base, imagen_url, descripcion, genero, tipo, temporada, atributos)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const insertValues = [
            data.nombre,
            data.precio, // Mapeado del esquema Zod (precio en body -> precio_base en BD)
            newImageUrl,
            data.descripcion || null,
            data.genero || 'unisex',
            data.tipo || 'general',
            data.temporada || 'neutro',
            atributos
        ];

        const result = await pool.query(insertQuery, insertValues);

        res.status(201).json({
            status: 'success',
            message: 'Producto creado exitosamente',
            data: result.rows[0]
        });

    } catch (error) {
        // Si hay error en la DB o Cloudinary, aseguramos no dejar basura local
        if (filePath) await fs.unlink(filePath).catch(() => {});
        return next(new AppError('Error interno al crear el producto: ' + error.message, 500));
    }
});

// ============================================================================
// 2. ACTUALIZAR PRODUCTO (Higiene de Cloudinary & Pool Direct)
// ============================================================================
const updateProduct = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const data = req.body;
    const filePath = req.file ? req.file.path : null;

    try {
        // Obtenemos imagen actual usando pool directamente
        const currentProdRes = await pool.query('SELECT imagen_url FROM productos WHERE id = $1', [id]);
        
        if (currentProdRes.rows.length === 0) {
            if (filePath) await fs.unlink(filePath).catch(() => {});
            return next(new AppError('Producto no encontrado', 404));
        }

        const oldImageUrl = currentProdRes.rows[0].imagen_url;
        let newImageUrl = oldImageUrl; 

        if (filePath) {
            const resCloud = await cloudinary.uploader.upload(filePath, { 
                folder: "tienda_v3_pro",
                use_filename: true, 
                transformation: [{ width: 800, crop: "limit" }]
            });
            newImageUrl = resCloud.secure_url;
            
            await fs.unlink(filePath).catch(() => {});

            if (oldImageUrl && oldImageUrl.includes('cloudinary.com')) {
                try {
                    const urlParts = oldImageUrl.split('/');
                    const fileWithExt = urlParts.pop(); 
                    const folder = urlParts.pop(); 
                    const fileName = fileWithExt.split('.')[0]; 
                    const oldPublicId = `${folder}/${fileName}`;
                    
                    await cloudinary.uploader.destroy(oldPublicId);
                } catch (cloudErr) {
                    console.warn("⚠️ Advertencia: No se pudo borrar la imagen vieja:", cloudErr.message);
                }
            }
        }

        const atributos = data.atributos ? JSON.stringify(data.atributos) : '{}';
        
        const updateQuery = `
            UPDATE productos 
            SET nombre = $1,
                precio_base = $2,
                imagen_url = $3,
                descripcion = $4,
                genero = $5,
                tipo = $6,
                temporada = $7,
                atributos = $8
            WHERE id = $9
            RETURNING *
        `;
        
        const updateValues = [
            data.nombre, 
            data.precio, 
            newImageUrl, 
            data.descripcion || null,
            data.genero || 'unisex',
            data.tipo || 'general',
            data.temporada || 'neutro',
            atributos,
            id
        ];

        const result = await pool.query(updateQuery, updateValues);

        res.status(200).json({
            status: 'success',
            message: 'Producto actualizado correctamente',
            data: result.rows[0]
        });

    } catch (error) {
        if (filePath) await fs.unlink(filePath).catch(() => {});
        return next(new AppError('Error interno al actualizar producto: ' + error.message, 500));
    }
});

// ============================================================================
// 3. ELIMINAR PRODUCTO (Soft Delete Integrado & Pool Direct)
// ============================================================================
const deleteProducto = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    // Ejecutamos el Soft Delete directamente aquí para evitar ProductService
    const deleteQuery = `
        UPDATE productos 
        SET deleted_at = CURRENT_TIMESTAMP, activo = false 
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id
    `;
    
    const result = await pool.query(deleteQuery, [id]);

    if (result.rows.length === 0) {
        return next(new AppError('Producto no encontrado o ya estaba eliminado', 404));
    }

    res.status(200).json({ status: 'success', message: 'Producto eliminado (Soft Delete) correctamente' });
});

// ============================================================================
// 4. AGREGAR VARIANTE A PRODUCTO (Inventario Dinámico & Pool Direct)
// ============================================================================
const addVariant = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { talle, color, stock_disponible, sku } = req.body;

    if (!talle || !color) {
        return next(new AppError('El talle y el color son obligatorios para crear una variante.', 400));
    }

    try {
        const prodRes = await pool.query('SELECT id, nombre FROM productos WHERE id = $1 AND deleted_at IS NULL', [id]);
        
        if (prodRes.rows.length === 0) {
            return next(new AppError('Producto base no encontrado o ha sido eliminado.', 404));
        }

        const insertQuery = `
            INSERT INTO inventario (producto_id, talle, color, stock, sku)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        
        const insertValues = [id, talle, color, stock_disponible || 0, sku || null];
        
        const result = await pool.query(insertQuery, insertValues);

        res.status(201).json({
            status: 'success',
            message: 'Variante agregada correctamente al inventario',
            data: {
                producto: prodRes.rows[0].nombre,
                variante: result.rows[0]
            }
        });

    } catch (error) {
        if (error.code === '23505') {
            return next(new AppError('Esta variante (talle y color) o el SKU ya existe para este producto.', 409));
        }
        return next(new AppError('Error al agregar variante: ' + error.message, 500));
    }
});

module.exports = {
    createProduct,
    updateProduct,
    deleteProducto,
    addVariant
};