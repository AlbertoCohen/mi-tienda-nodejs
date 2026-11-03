const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, withRbacTransaction } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_jwt_2026';

async function register(req, res) {
  try {
    const { email, password, first_name, last_name, dni_cuit } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Datos incompletos o contraseña menor a 8 caracteres.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const user = await withRbacTransaction('customer', async (client) => {
      const u = await client.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'customer') RETURNING id, email, role`,
        [email.toLowerCase().trim(), hash]
      );
      await client.query(
        `INSERT INTO user_profiles (user_id, first_name, last_name, dni_cuit) VALUES ($1, $2, $3, $4)`,
        [u.rows[0].id, first_name || null, last_name || null, dni_cuit || null]
      );
      return u.rows[0];
    });

    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El email ya se encuentra registrado.' });
    return res.status(500).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const uRes = await query(`SELECT id, email, password_hash, role, is_active FROM users WHERE email = $1`, [String(email).toLowerCase().trim()]);
    const user = uRes.rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function elevateRole(req, res) {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Solo SuperAdmin puede delegar roles.' });
    }
    const { targetUserId, newRole } = req.body;
    if (newRole !== 'admin' && newRole !== 'customer') {
      return res.status(400).json({ error: 'Rol destino inválido.' });
    }
    const updated = await withRbacTransaction('superadmin', async (client) => {
      const r = await client.query(`UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role`, [newRole, targetUserId]);
      return r.rows[0];
    });
    return res.status(200).json({ message: 'Rol delegado con éxito.', user: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function mergeAndGetCart(req, res) {
  try {
    const userId = req.user ? req.user.sub : null;
    const { sessionToken, itemsToAdd = [] } = req.body;

    const data = await withRbacTransaction(req.user?.role || 'customer', async (client) => {
      let cartId = null;
      if (userId) {
        const c = await client.query(`SELECT id FROM carts WHERE user_id = $1 AND status = 'active' LIMIT 1`, [userId]);
        cartId = c.rows[0]?.id || (await client.query(`INSERT INTO carts (user_id, status) VALUES ($1, 'active') RETURNING id`, [userId])).rows[0].id;
        if (sessionToken) {
          const g = await client.query(`SELECT id FROM carts WHERE session_token = $1 AND status = 'active' AND user_id IS NULL`, [sessionToken]);
          if (g.rowCount > 0) {
            await client.query(`
              INSERT INTO cart_items (cart_id, product_variant_id, quantity, unit_price)
              SELECT $1, ci.product_variant_id, ci.quantity, ci.unit_price FROM cart_items ci WHERE ci.cart_id = $2
              ON CONFLICT (cart_id, product_variant_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
            `, [cartId, g.rows[0].id]);
            await client.query(`UPDATE carts SET status = 'converted' WHERE id = $1`, [g.rows[0].id]);
          }
        }
      } else {
        const c = await client.query(`SELECT id FROM carts WHERE session_token = $1 AND status = 'active' LIMIT 1`, [sessionToken]);
        cartId = c.rows[0]?.id || (await client.query(`INSERT INTO carts (session_token, status) VALUES ($1, 'active') RETURNING id`, [sessionToken])).rows[0].id;
      }

      for (const item of itemsToAdd) {
        await client.query(`
          INSERT INTO cart_items (cart_id, product_variant_id, quantity, unit_price) VALUES ($1, $2, $3, $4)
          ON CONFLICT (cart_id, product_variant_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
        `, [cartId, item.variantId, item.quantity || 1, item.unitPrice]);
      }

      await client.query(`UPDATE carts SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1`, [cartId]);

      const items = await client.query(`
        SELECT ci.id AS item_id, ci.quantity, ci.unit_price, (ci.quantity * ci.unit_price) AS line_total,
               pv.id AS variant_id, pv.size, pv.color, p.name AS product_name, p.season AS product_season, c.name AS category_name
        FROM cart_items ci
        JOIN product_variants pv ON pv.id = ci.product_variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE ci.cart_id = $1
      `, [cartId]);

      const subtotal = items.rows.reduce((acc, r) => acc + parseFloat(r.line_total), 0);
      return { cartId, subtotal: subtotal.toFixed(2), itemCount: items.rows.reduce((acc, r) => acc + r.quantity, 0), items: items.rows };
    });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function authenticateToken(required = true) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      if (required) return res.status(401).json({ error: 'Token no provisto.' });
      req.user = null;
      return next();
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err && required) return res.status(403).json({ error: 'Token inválido.' });
      req.user = decoded || null;
      next();
    });
  };
}

module.exports = { register, login, elevateRole, mergeAndGetCart, authenticateToken };
