// src/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Configuración SSL necesaria para Render y la mayoría de nubes
    ssl: process.env.DATABASE_URL ? {
        rejectUnauthorized: false // Esto permite certificados autofirmados (común en tiers gratuitos)
    } : false
});

// Eventos para monitorear la salud de la BD
pool.on('connect', () => {
    // console.log('Base de datos conectada exitosamente'); // Descomentar para debug
});

pool.on('error', (err) => {
    console.error('Error inesperado en el cliente de PG', err);
    process.exit(-1); // Si falla la BD, matamos el proceso para que el orquestador lo reinicie
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};