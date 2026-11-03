const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[CRITICAL] Falta DATABASE_URL en el entorno.');
}

const pool = new Pool({
  connectionString: databaseUrl || 'postgres://localhost:5432/ecommerce_db',
  ssl: databaseUrl && databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

async function query(text, params) {
  return await pool.query(text, params);
}

async function withRbacTransaction(userRole, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sanitizedRole = ['superadmin', 'admin', 'customer'].includes(userRole) ? userRole : 'customer';
    await client.query(`SET LOCAL app.current_user_role = '${sanitizedRole}'`);
    const res = await callback(client);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withRbacTransaction };
