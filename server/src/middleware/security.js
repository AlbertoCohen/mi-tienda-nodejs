const crypto = require('crypto');
const { query } = require('../config/database');

const loginAttempts = new Map();

function authRateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const email = (req.body?.email || '').toLowerCase().trim();
  const key = `${ip}_${email}`;
  const now = Date.now();
  const rec = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };

  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + 15 * 60 * 1000;
  }

  if (rec.count >= 5) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Intente más tarde.' });
  }

  const origJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 401) {
      rec.count += 1;
      loginAttempts.set(key, rec);
    } else if (res.statusCode === 200) {
      loginAttempts.delete(key);
    }
    return origJson(body);
  };
  next();
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const k of Object.keys(req.body)) {
      if (typeof req.body[k] === 'string') {
        req.body[k] = req.body[k].slice(0, 5000).replace(/\0/g, '');
      }
    }
  }
  next();
}

function verifyResourceOwnership(resourceTable, idParamName) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Autenticación requerida.' });
      if (user.role === 'superadmin' || user.role === 'admin') return next();

      const rId = req.params[idParamName];
      let sql = '';
      if (resourceTable === 'orders') sql = `SELECT user_id FROM orders WHERE id = $1`;
      else if (resourceTable === 'fiscal_invoices') sql = `SELECT o.user_id FROM fiscal_invoices fi JOIN orders o ON o.id = fi.order_id WHERE fi.order_id = $1`;

      const result = await query(sql, [rId]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Recurso no encontrado.' });
      if (result.rows[0].user_id !== user.sub) return res.status(403).json({ error: 'Acceso Denegado.' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

function sanitizeTrackingNumber(tracking) {
  return String(tracking || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function secureErrorHandler(err, req, res, next) {
  const incidentId = crypto.randomUUID();
  console.error(`[SEC_ERROR_${incidentId}]`, err.message);
  res.status(err.status || 500).json({
    error: 'Ocurrió un error en el procesamiento seguro.',
    incidentId
  });
}

module.exports = {
  authRateLimiter,
  sanitizeInput,
  verifyResourceOwnership,
  sanitizeTrackingNumber,
  secureErrorHandler
};
