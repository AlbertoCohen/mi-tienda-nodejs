// src/routes/product.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const productController = require('../controllers/product.controller');

// Configuración de Multer: 
// Guardamos temporalmente en 'uploads/' para que el Service lo suba a Cloudinary
const upload = multer({ dest: 'uploads/' });

// Definición de Rutas
router.get('/productos', productController.getProductos);

router.post('/admin/nuevo', 
    upload.single('imagen'), // Middleware que procesa la subida
    productController.createProducto
);

router.delete('/admin/eliminar/:id', productController.deleteProducto);

module.exports = router;