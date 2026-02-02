// src/routes/product.routes.js
//Define los endpoints finales.

const express = require('express');
const router = express.Router();

// Importamos controladores y middlewares
const productController = require('../controllers/product.controller');
const upload = require('../middlewares/upload');
const { validarProducto } = require('../middlewares/validator');

// --- RUTAS PÚBLICAS (Cliente) ---

// Catálogo inteligente (Soporta ?temporada=verano&talle=S&limit=10)
router.get('/productos', productController.getProductos);

// Detalle de producto
router.get('/productos/:id', productController.getProductoDetalle);

// Configuración Global (Para saber si es Navidad/Verano)
router.get('/config', productController.getConfig);


// --- RUTAS TRANSACCIONALES (Ventas) ---

// Registrar venta (Descuenta stock atómicamente)
router.post('/ventas/nueva', productController.crearVenta);


// --- RUTAS ADMIN (Gestión) ---

// Crear Producto: 1. Sube Foto -> 2. Valida Datos -> 3. Crea en DB
router.post('/admin/nuevo', 
    upload.single('imagen'), // Multer procesa el archivo primero
    validarProducto,         // Zod valida que el precio no sea -50
    productController.createProducto // El controlador ejecuta
);

// Eliminar Producto (Soft Delete)
router.delete('/admin/eliminar/:id', productController.deleteProducto);


module.exports = router;