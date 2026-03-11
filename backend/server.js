const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const dotenv = require('dotenv');

// --- 1. CONFIGURACIÓN Y VALIDACIÓN DE ENTORNO (ZOD) ---
dotenv.config();

// Definimos el esquema de variables requeridas
const envSchema = z.object({
    PORT: z.string().default('3000'),
    DATABASE_URL: z.string({ required_error: "Falta DATABASE_URL en .env" }).min(1),
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    CLOUDINARY_CLOUD_NAME: z.string({ required_error: "Falta CLOUDINARY_CLOUD_NAME" }),
    CLOUDINARY_API_KEY: z.string({ required_error: "Falta CLOUDINARY_API_KEY" }),
    CLOUDINARY_API_SECRET: z.string({ required_error: "Falta CLOUDINARY_API_SECRET" }),
    JWT_SECRET: z.string({ required_error: "Falta JWT_SECRET en .env" }).min(16),   
    JWT_EXPIRES_IN: z.string().default('7d')
});

// Validamos process.env
const envValidation = envSchema.safeParse(process.env);

if (!envValidation.success) {
    console.error("❌ Error Crítico: Variables de entorno inválidas:");
    console.error(JSON.stringify(envValidation.error.format(), null, 2));
    process.exit(1);
}

const env = envValidation.data;

// --- 2. IMPORTACIONES INTERNAS ---
const authRoutes = require('./src/routes/auth.routes');
const productRoutes = require('./src/routes/product.routes');
const cartRoutes = require('./src/routes/cart.routes');
const adminRoutes = require('./src/routes/admin.routes');
const errorHandler = require('./src/middlewares/errorHandler');
const AppError = require('./src/utils/AppError');
const { pool } = require('./src/config/db');

const app = express();
const PORT = env.PORT;

// --- 3. MIDDLEWARES DE SEGURIDAD Y PARSEO ---

// Helmet
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate Limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: "Demasiadas peticiones desde esta IP, intenta más tarde." }
});
app.use('/api', limiter);

// CORS
app.use(cors());

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 4. RUTAS ---

// Health Check
app.get('/', (req, res) => {
    res.status(200).json({ status: 'success', message: 'API Tienda V3 Pro - Online 🚀' });
});

// API de Identidad (Pública)
app.use('/api/auth', authRoutes);

// APIs Públicas
app.use('/api/productos', productRoutes);
app.use('/api/carrito', cartRoutes);

// API Privada (Administración)
app.use('/api/admin', adminRoutes);

// --- CORRECCIÓN 404: Catch-All sin 'path-to-regexp' ---
// Usamos app.use() sin ruta. Esto captura CUALQUIER petición que no haya 
// sido resuelta por las rutas anteriores.
app.use((req, res, next) => {
    next(new AppError(`No se encontró la ruta ${req.originalUrl} en este servidor`, 404));
});

// --- 5. MANEJO GLOBAL DE ERRORES ---
app.use(errorHandler);

// --- 6. ARRANQUE DEL SERVIDOR ---

const server = app.listen(PORT, '0.0.0.0', async () => {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW()');
        client.release();
        
        console.log(`✅ Base de Datos conectada: ${res.rows[0].now}`);
        console.log(`🚀 Servidor Profesional corriendo en puerto ${PORT} (${env.NODE_ENV})`);
    } catch (err) {
        console.error('❌ Error conectando a la Base de Datos:', err.message);
        server.close(() => process.exit(1));
    }
});

// --- 7. GRACEFUL SHUTDOWN ---
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM recibido. Cerrando servidor...');
    server.close(() => {
        console.log('💥 Servidor HTTP cerrado.');
        pool.end(() => {
            console.log('🔌 Conexiones a BD cerradas.');
            process.exit(0);
        });
    });
});