const ProductService = require('../services/product.service');
const catchAsync = require('../utils/catchAsync');
const { pool } = require('../config/db');
const cloudinary = require('../config/cloudinary');
const fs = require('fs').promises;
const AppError = require('../utils/AppError');

// 1. CREAR PRODUCTO
const createProduct = catchAsync(async (req, res, next) => {
    const imagenUrl = req.file ? req.file.path : null;
    const nuevoProducto = await ProductService.crearProducto(req.body, imagenUrl);

    res.status(201).json({
        status: 'success',
        data: nuevoProducto
    });
});

// 2. ACTUALIZAR PRODUCTO (HIGIENE CLOUDINARY)
const updateProduct = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const data = req.body;
    const filePath = req.file ? req.file.path : null;

    const client = await pool.connect();

    try {
        const currentProdRes = await client.query('SELECT imagen_url FROM productos WHERE id = $1', [id]);
        
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
                    console.warn("⚠️ Advertencia: No se pudo borrar la imagen vieja en Cloudinary:", cloudErr.message);
                }
            }
        }

        const atributos = data.atributos ? JSON.stringify(data.atributos) : '{}';
        
        // Renombrado a updateQuery para evitar colisiones
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

        const result = await client.query(updateQuery, updateValues);

        res.status(200).json({
            status: 'success',
            message: 'Producto actualizado correctamente',
            data: result.rows[0]
        });

    } catch (error) {
        if (filePath) await fs.unlink(filePath).catch(() => {});
        throw error; 
    } finally {
        client.release();
    }
});

// 3. ELIMINAR PRODUCTO
const deleteProducto = catchAsync(async (req, res, next) => {
    await ProductService.eliminarProducto(req.params.id);
    res.status(200).json({ status: 'success', message: 'Producto eliminado (Soft Delete)' });
});

// 4. AGREGAR VARIANTE A PRODUCTO (INVENTARIO DINÁMICO)
const addVariant = catchAsync(async (req, res, next) => {
    const { id } = req.params; // producto_id
    const { talle, color, stock_disponible, sku } = req.body;

    if (!talle || !color) {
        return next(new AppError('El talle y el color son obligatorios para crear una variante.', 400));
    }

    const client = await pool.connect();

    try {
        const prodRes = await client.query('SELECT id, nombre FROM productos WHERE id = $1 AND deleted_at IS NULL', [id]);
        
        if (prodRes.rows.length === 0) {
            return next(new AppError('Producto base no encontrado o ha sido eliminado.', 404));
        }

        // Renombrado a insertQuery y uso exclusivo de la tabla 'inventario'
        const insertQuery = `
            INSERT INTO inventario (producto_id, talle, color, stock, sku)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        
        const insertValues = [id, talle, color, stock_disponible || 0, sku || null];
        
        const result = await client.query(insertQuery, insertValues);

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
        throw error;
    } finally {
        client.release();
    }
});

module.exports = {
    createProduct,
    updateProduct,
    deleteProducto,
    addVariant
};