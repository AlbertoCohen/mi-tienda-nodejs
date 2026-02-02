// src/config/db.js
// Define tablas, relaciones, constraints (reglas de negocio en DB) e índices.

const { Pool } = require('pg');
require('dotenv').config();

// Configuración del Pool de Conexiones
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    max: 20, // Máximo de conexiones simultáneas
    idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
    console.error('❌ Error inesperado en cliente PG', err);
    process.exit(-1);
});

async function initDB() {
    try {
        // --- ZONA DE MIGRACIÓN (Descomentar UNA VEZ si necesitas resetear todo) ---
        /*
        console.log('⚠️ Reseteando Base de Datos...');
        await pool.query('DROP TABLE IF EXISTS ventas CASCADE');
        await pool.query('DROP TABLE IF EXISTS inventario CASCADE');
        await pool.query('DROP TABLE IF EXISTS producto_etiquetas CASCADE');
        await pool.query('DROP TABLE IF EXISTS reglas_precio CASCADE');
        await pool.query('DROP TABLE IF EXISTS etiquetas CASCADE');
        await pool.query('DROP TABLE IF EXISTS configuraciones CASCADE');
        await pool.query('DROP TABLE IF EXISTS productos CASCADE');
        */
        // -------------------------------------------------------------------------

        // 1. CONFIGURACIONES GLOBALES (Key-Value Store)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS configuraciones (
                clave TEXT PRIMARY KEY,
                valor TEXT NOT NULL,
                descripcion TEXT
            );
        `);

        // 2. PRODUCTOS (Con Soft Deletes y JSONB)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS productos (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                -- CONSTRAINT: Precio nunca negativo
                precio_base NUMERIC(10, 2) NOT NULL CHECK (precio_base >= 0),
                imagen_url TEXT,
                genero TEXT,
                tipo TEXT,
                temporada TEXT DEFAULT 'neutro',
                atributos JSONB DEFAULT '{}', -- Flexibilidad futura
                vistas INTEGER DEFAULT 0,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP DEFAULT NULL -- Soft Delete
            );
        `);

        // 3. ETIQUETAS (Tags dinámicos: Navidad, Oferta, etc.)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS etiquetas (
                id SERIAL PRIMARY KEY,
                nombre TEXT UNIQUE NOT NULL,
                color_hex TEXT
            );
        `);

        // 4. RELACIÓN PRODUCTO <-> ETIQUETA
        await pool.query(`
            CREATE TABLE IF NOT EXISTS producto_etiquetas (
                producto_id INTEGER REFERENCES productos(id),
                etiqueta_id INTEGER REFERENCES etiquetas(id),
                PRIMARY KEY (producto_id, etiqueta_id)
            );
        `);

        // 5. INVENTARIO (Variantes Talle/Color)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inventario (
                id SERIAL PRIMARY KEY,
                producto_id INTEGER REFERENCES productos(id),
                color TEXT NOT NULL,
                talle TEXT NOT NULL,
                -- CONSTRAINT: Stock nunca negativo
                stock INTEGER DEFAULT 0 CHECK (stock >= 0),
                UNIQUE(producto_id, color, talle) -- Evita duplicados lógicos
            );
        `);

        // 6. REGLAS DE PRECIO (Eventos Temporales)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reglas_precio (
                id SERIAL PRIMARY KEY,
                etiqueta_id INTEGER REFERENCES etiquetas(id),
                nombre_evento TEXT,
                porcentaje_descuento INTEGER DEFAULT 0 CHECK (porcentaje_descuento BETWEEN 0 AND 100),
                fecha_inicio TIMESTAMP,
                fecha_fin TIMESTAMP,
                activo BOOLEAN DEFAULT TRUE
            );
        `);

        // 7. VENTAS (Historial Inmutable)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ventas (
                id SERIAL PRIMARY KEY,
                producto_id INTEGER REFERENCES productos(id),
                detalle_variante TEXT, -- Snapshot (Ej: "Rojo M")
                cantidad INTEGER NOT NULL CHECK (cantidad > 0),
                precio_final NUMERIC(10, 2) NOT NULL CHECK (precio_final >= 0),
                fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // --- ÍNDICES (Performance Tuning) ---
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);`);
        // Índice compuesto para filtros frecuentes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_productos_filtro ON productos(genero, temporada, tipo);`);
        // Índice parcial (solo productos activos)
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_productos_activos ON productos(id) WHERE deleted_at IS NULL;`);

        // Configuración por defecto
        await pool.query(`
            INSERT INTO configuraciones (clave, valor, descripcion) 
            VALUES ('modo_tienda', 'default', 'Modo visual actual')
            ON CONFLICT DO NOTHING;
        `);

        console.log('✅ Base de datos Sincronizada y Blindada.');
    } catch (error) {
        console.error('❌ Error crítico Schema DB:', error);
    }
}

// Exportamos initDB y el pool para transacciones
module.exports = { initDB, pool, query: (text, params) => pool.query(text, params) };