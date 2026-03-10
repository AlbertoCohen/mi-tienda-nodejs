const express = require('express');
const router = express.Router();
const publicCatalogController = require('../controllers/public.catalog.controller');
const validate = require('../middlewares/validator');
const { saleSchema } = require('../utils/schemas');

// --- RUTAS PÚBLICAS (Lectura) ---

// 1. Catálogo General
router.get('/', publicCatalogController.getProducts);

// 2. Configuración (IMPORTANTE: Debe ir ANTES de /:id)
router.get('/config', publicCatalogController.getConfig);

// 3. Detalle de Producto (Recibe un ID dinámico)
router.get('/:id', publicCatalogController.getProductoDetalle);


// --- RUTAS DE VENTAS ---

// 4. Registrar Venta (Validado con Zod)
router.post('/ventas/nueva', 
    validate(saleSchema), 
    publicCatalogController.crearVenta
);

module.exports = router;