import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Pool configuration using Neon PgBouncer transaction-mode connection
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20, // Max concurrent connections per node process
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB POOL ERROR] Unexpected error on idle client:', err.message);
});

export const query = (text, params) => pool.query(text, params);
