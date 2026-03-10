const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// ==========================================
// DOMINIO DE IDENTIDAD (Prefijo: /api/auth)
// ==========================================

// Estas rutas DEBEN ser públicas. ¡No les inyectes el middleware verifyToken!
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;