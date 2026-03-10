const ProductDAO = require('../daos/product.dao');
const ProductService = require('../services/product.service');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// 1. OBTENER PRODUCTOS
const getProducts = catchAsync(async (req, res, next) => {
    const { modo } = req.query;
    const productos = await ProductDAO.getAll({ modo });

    res.json({
        status: 'success',
        results: productos.length,
        modo_actual: modo || 'todos',
        data: { productos }
    });
});

// 2. OBTENER DETALLE 
const getProductoDetalle = catchAsync(async (req, res, next) => {
    const producto = await ProductService.obtenerDetalle(req.params.id);
    
    if (!producto) {
        return next(new AppError('No se encontró producto con ese ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: producto
    });
});

// 3. CONFIGURACIÓN
const getConfig = catchAsync(async (req, res, next) => {
    const modo = await ProductService.obtenerConfig('modo_tienda');
    res.status(200).json({ mode: modo || 'default' });
});

// 4. CREAR VENTA
const crearVenta = catchAsync(async (req, res, next) => {
    const ventaExitosa = await ProductService.registrarVenta(req.body);

    res.status(200).json({
        status: 'success',
        message: 'Venta registrada correctamente',
        data: ventaExitosa
    });
});

module.exports = {
    getProducts,
    getProductoDetalle,
    getConfig,
    crearVenta 
};