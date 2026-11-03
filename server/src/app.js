const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api.routes');
const { query } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    return res.status(200).json({ status: 'OK', keepAlive: true });
  } catch (e) {
    return res.status(200).json({ status: 'DEGRADED', reason: e.message });
  }
});

app.use('/api', apiRoutes);

// Servir frontend compilado en producción
const clientDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(200).send('<h1>Gauntlet E-Commerce Omega API Online</h1>');
  });
});

// CRON AUTO-PING (5m Free Tier Keep-Alive)
setInterval(async () => {
  try {
    await fetch(`${APP_URL}/api/health`);
    console.log('[CRON_5M] Keep-alive ping enviado.');
  } catch (e) {}
}, 5 * 60 * 1000);

// CRON CARRITOS ABANDONADOS (10m)
setInterval(async () => {
  try {
    const res = await query(`
      UPDATE carts SET status = 'abandoned', updated_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT id FROM carts WHERE status = 'active' AND last_activity_at < (CURRENT_TIMESTAMP - INTERVAL '2 HOURS')
        LIMIT 20 FOR UPDATE SKIP LOCKED
      ) RETURNING id, user_id;
    `);
    for (const c of res.rows) {
      await query(`
        INSERT INTO promotion_redemptions (promotion_id, user_id, cart_id)
        SELECT id, $1, $2 FROM promotions WHERE code = 'VUELVE10' LIMIT 1;
      `, [c.user_id, c.id]);
    }
  } catch (e) {}
}, 10 * 60 * 1000);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[CORE] Servidor activo en puerto ${PORT}`);
  });
}

module.exports = app;
