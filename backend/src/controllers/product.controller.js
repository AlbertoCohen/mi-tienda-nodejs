// src/controllers/product.controller.js
//El director de orquesta. Recibe la petición, llama al servicio y responde. Nota qué limpio está gracias a catchAsync.

const productService = require('../services/product.service');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// --- LECTURA ---

exports.getProductos = catchAsync(async (req, res, next) => {
    // Pasa los filtros (query params) directo al DAO inteligente
    const productos = await productService.listarProductos(req.query);
    
    res.status(200).json({
        status: 'success',
        results: productos.length,
        data: productos
    });
});

exports.getProductoDetalle = catchAsync(async (req, res, next) => {
    const producto = await productService.obtenerDetalle(req.params.id);
    
    if (!producto) {
        return next(new AppError('No se encontró producto con ese ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: producto
    });
});

exports.getConfig = catchAsync(async (req, res, next) => {
    // Sirve para que el frontend sepa en qué modo está (Navidad, Verano, etc.)
    const modo = await productService.obtenerConfig('modo_tienda');
    res.status(200).json({ mode: modo || 'default' });
});

// --- ESCRITURA (ADMIN) ---

// --- ESCRITURA (ADMIN) - VERSIÓN DEBUG ---
exports.createProducto = catchAsync(async (req, res, next) => {
    console.log("------------------------------------------");
    console.log("🔍 DEBUG: Intentando crear producto");
    console.log("📂 Archivo recibido:", req.file ? "SÍ" : "NO");
    console.log("📝 Datos del Body:", req.body);
    console.log("------------------------------------------");

    // 1. Capturamos archivo
    const filePath = req.file ? req.file.path : null;
    
    // 2. Crear
    const nuevoProducto = await productService.crearProducto(req.body, filePath);

    // 3. Responder
    res.status(201).json({
        status: 'success',
        data: nuevoProducto
    });
});
exports.deleteProducto = catchAsync(async (req, res, next) => {
    await productService.eliminarProducto(req.params.id);
    
    res.status(200).json({
        status: 'success',
        message: 'Producto eliminado (Soft Delete)'
    });
});

// --- TRANSACCIONES (VENTAS) ---

exports.crearVenta = catchAsync(async (req, res, next) => {
    if (!req.body.producto_id || !req.body.cantidad) {
        return next(new AppError('Faltan datos de la venta (producto_id, cantidad)', 400));
    }

    // Ejecuta la transacción ACID
    const venta = await productService.registrarVenta(req.body);

    res.status(201).json({
        status: 'success',
        message: 'Venta registrada y stock descontado',
        data: venta
    });
});