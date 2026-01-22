const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. HELMET: Oculta info del servidor y protege cabeceras HTTP
// (Evita que hackers sepan que usas Express y exploten vulnerabilidades conocidas)
app.use(helmet({
  contentSecurityPolicy: false // Permite cargar fotos de Cloudinary sin problemas
}));

// 2. RATE LIMIT: Evita ataques de fuerza bruta o DDoS
// (Si alguien hace más de 100 peticiones en 15 minutos, lo bloqueamos)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite por IP
  message: "Demasiadas peticiones desde esta IP, intenta de nuevo en 15 min."
});
app.use(limiter);

// 3. CORS RESTRINGIDO (Importante para producción)
// Ahora mismo tienes cors() que permite TODO.
// Cambialo por esto cuando tengas tu dominio real:
/*
const whitelist = ['https://mitienda.com', 'https://tu-frontend.onrender.com'];
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true)
    } else {
      callback(new Error('Bloqueado por CORS'))
    }
  }
}
app.use(cors(corsOptions));
*/
// Por ahora deja app.use(cors()) hasta que tengas dominio, pero tenlo en mente.

// --- Middlewares Globales ---
app.use(cors()); // Permite conexiones externas
app.use(express.json()); // Permite leer JSON en el body

// Servir archivos estáticos del Front-End (HTML, CSS, JS)
// Esto permite que al entrar a la web veas tu página
app.use(express.static(path.join(__dirname)));

// --- Rutas de la API ---
const productRoutes = require('./src/routes/product.routes');
app.use('/api', productRoutes);

// --- Inicialización de Base de Datos (Script Automático) ---
// Como no usamos migraciones complejas, esto crea la tabla si no existe al arrancar
const db = require('./src/config/db');

async function initDB() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS productos (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                precio NUMERIC NOT NULL,
                imagen_url TEXT
            );
        `);
        console.log('✅ Base de datos sincronizada (Tabla productos lista)');
    } catch (error) {
        console.error('❌ Error crítico iniciando la DB:', error);
        // No matamos el proceso, pero avisamos que sin DB no funcionará bien
    }
}

// Arrancar el servidor
app.listen(PORT, async () => {
    await initDB();
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});