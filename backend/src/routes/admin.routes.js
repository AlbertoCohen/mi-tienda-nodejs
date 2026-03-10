const express = require('express');
const router = express.Router();
const adminProductController = require('../controllers/admin.product.controller');
const adminOrdersController = require('../controllers/admin.orders.controller');
const upload = require('../middlewares/upload');
const validate = require('../middlewares/validator');
const { productSchema } = require('../utils/schemas');
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');

// ==========================================
// DOMINIO DE BACKOFFICE (Prefijo: /api/admin)
// ==========================================

// --- INYECCIÓN DE SEGURIDAD GLOBAL (CANDADO RBAC) ---
// Al usar router.use() aquí, TODAS las rutas que definamos debajo 
// exigirán obligatoriamente un JWT válido y el rol de 'admin'.
router.use(verifyToken, isAdmin);

// --- RUTAS DE ADMINISTRACIÓN DE PRODUCTOS ---

// 1. Crear Producto (Validado con Zod y Multer)
router.post('/productos/nuevo', 
    upload.single('imagen'), 
    validate(productSchema), 
    adminProductController.createProduct
);

// 2. Actualizar Producto (Validado con Zod y Multer)
router.put('/productos/:id', 
    upload.single('imagen'), 
    validate(productSchema), 
    adminProductController.updateProduct
);

// 3. Eliminar Producto (Soft Delete)
router.delete('/productos/:id', adminProductController.deleteProducto);

// 4. Agregar Variante (Inventario Dinámico)
router.post('/productos/:id/variantes', adminProductController.addVariant);

// --- RUTAS DE ADMINISTRACIÓN DE ÓRDENES (OMS) ---

// 5. Obtener el historial completo de órdenes
router.get('/ordenes', adminOrdersController.getAllOrders);

// 6. Actualizar el estado logístico de una orden específica
router.put('/ordenes/:id/estado', adminOrdersController.updateOrderStatus);

module.exports = router;