const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;


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