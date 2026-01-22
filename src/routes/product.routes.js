// src/routes/product.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const productController = require('../controllers/product.controller');

// Configuración de Multer: 
// ARQUITECTURA: Usamos el directorio temporal del sistema.
// Esto desacopla el código de la estructura de carpetas del proyecto.
// Usamos la carpeta temporal del sistema (os.tmpdir())
// Esto funciona en Windows, Linux, Mac y Servidores Cloud sin fallar nunca.
const upload = multer({ dest: os.tmpdir() });

// Definición de Rutas
router.get('/productos', productController.getProductos);

// El middleware 'upload' intercepta el archivo antes de llegar al controlador
router.post('/admin/nuevo', 
    upload.single('imagen'), 
    productController.createProducto
);

router.delete('/admin/eliminar/:id', productController.deleteProducto);

module.exports = router;
