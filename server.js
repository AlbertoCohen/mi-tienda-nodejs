// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importamos manejo de errores y DB
const errorHandler = require('./src/middlewares/errorHandler');
const AppError = require('./src/utils/AppError');
const { initDB, pool } = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. SEGURIDAD (Blindaje del Servidor) ---

// Helmet: Protege cabeceras HTTP.
// Desactivamos CSP para permitir imágenes externas (Cloudinary) y scripts inline.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate Limit: Evita ataques de fuerza bruta (DDoS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Límite de 100 peticiones por IP
    message: "Demasiadas peticiones desde esta IP, intenta en 15 minutos."
});
app.use('/api', limiter); // Solo limitamos la API, no el frontend estático

// CORS: Permite peticiones desde cualquier origen (ajustar en producción real)
app.use(cors());

// --- 2. MIDDLEWARES GLOBALES ---
app.use(express.json()); // Parseo de JSON en el body
app.use(express.static(path.join(__dirname))); // Servir archivos estáticos (Frontend)

// --- 3. RUTAS ---
const productRoutes = require('./src/routes/product.routes');
app.use('/api', productRoutes);

// Manejo de Rutas No Encontradas (404)
app.all('*', (req, res, next) => {
    next(new AppError(`No se encontró la ruta ${req.originalUrl} en este servidor`, 404));
});

// --- 4. MANEJO DE ERRORES CENTRALIZADO ---
app.use(errorHandler);

// --- 5. ARRANQUE DEL SERVIDOR ---
const server = app.listen(PORT, async () => {
    await initDB(); // Inicializar tablas e índices
    console.log(`🚀 Servidor Profesional corriendo en puerto ${PORT}`);
});

// --- 6. GRACEFUL SHUTDOWN (Apagado Seguro) ---
// Captura señales de terminación para cerrar conexiones DB antes de morir
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM recibido. Cerrando servidor...');
    server.close(() => {
        console.log('💥 Servidor cerrado.');
        pool.end(); // Cerrar conexión a PostgreSQL
    });
});