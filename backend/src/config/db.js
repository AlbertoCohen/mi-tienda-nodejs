const { Pool } = require('pg');
require('dotenv').config();

// --- 1. INTELIGENCIA DE CONEXIÓN ---

let useSSL = false;
let hostname = 'unknown';

try {
    if (process.env.DATABASE_URL) {
        const urlParams = new URL(process.env.DATABASE_URL);
        hostname = urlParams.hostname;
        
        // Lógica de Detección Automática:
        // Si el host NO es localhost ni 127.0.0.1, asumimos que es una Nube (Render, Neon, AWS)
        // y FORZAMOS SSL.
        const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
        
        // Activamos SSL si es remoto, si es producción, o si se fuerza en .env
        useSSL = !isLocalHost || process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true';
    }
} catch (error) {
    console.warn("⚠️ Error parseando DATABASE_URL para configuración automática.");
}

const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    // rejectUnauthorized: false es vital para Render/Neon y otras nubes con certificados compartidos
    ssl: useSSL ? { rejectUnauthorized: false } : false
};

const pool = new Pool(poolConfig);

// --- 2. LOGGING DE DEBUGGING ---

// Solo imprimimos si no estamos en test para no ensuciar logs
if (process.env.NODE_ENV !== 'test') {
    console.log(`🔌 Estado de Conexión DB:`);
    console.log(`   ➤ Objetivo: ${hostname}`);
    console.log(`   ➤ Modo SSL: ${useSSL ? 'ACTIVADO (Secure 🔒)' : 'DESACTIVADO (Local 🏠)'}`);
    if (!useSSL && hostname.includes('render.com')) {
        console.warn("⚠️ ALERTA: Conectando a Render sin SSL. Esto fallará.");
    }
}

// --- 3. WRAPPER PARA CONSULTAS ---

const query = async (text, params) => {
    try {
        const start = Date.now();
        const res = await pool.query(text, params);
        // const duration = Date.now() - start;
        // console.log('SQL Exec:', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('❌ Error ejecutando Query:', error.message);
        throw error;
    }
};

module.exports = { pool, query };