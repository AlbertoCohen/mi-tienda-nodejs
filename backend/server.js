import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import zlib from 'zlib';
import { pool } from './src/config/db.js';

// Import Routes
import authRoutes from './src/routes/auth.routes.js';
import productRoutes from './src/routes/product.routes.js';
import cartRoutes from './src/routes/cart.routes.js';
import paymentsRoutes from './src/routes/payments.routes.js';
import adminRoutes from './src/routes/admin.routes.js';

// Import Middlewares
import { errorHandler } from './src/middlewares/errorHandler.js';
import { catalogRateLimiter } from './src/middlewares/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');

// 1. Security Headers (HSTS, CSP, X-Frame-Options)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://sdk.mercadopago.com', 'https://static.cloudflareinsights.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com', 'https://*.mercadopago.com', 'https://www.afip.gob.ar'],
        connectSrc: ["'self'", 'https://api.mercadopago.com', 'https://res.cloudinary.com'],
        frameSrc: ["'self'", 'https://www.mercadopago.com.ar', 'https://www.mercadopago.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })
);

// 2. Strict CORS Policy
const allowedOrigins = [
  process.env.APP_PUBLIC_URL || 'https://tutienda.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === 'null') {
        return callback(null, false);
      }
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Bloqueado por política de seguridad CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
);

// 3. Optimized Brotli Compression
app.use(
  compression({
    threshold: 1024,
    brotli: {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4
      }
    }
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 4. Rate Limiting on Global Catalog
app.use('/api', catalogRateLimiter);

// 5. Keep-Alive & Deep Health Probe
app.get('/api/health', async (req, res) => {
  let dbStatus = 'DISCONNECTED';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const dbCheck = await pool.query('SELECT 1 AS alive');
      if (dbCheck.rows[0]?.alive === 1) {
        dbStatus = 'CONNECTED';
        break;
      }
    } catch {
      if (attempt < 3) await new Promise((r) => setTimeout(r, 200));
    }
  }

  const statusCode = dbStatus === 'CONNECTED' ? 200 : 503;
  return res.status(statusCode).json({
    status: dbStatus === 'CONNECTED' ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
  });
});

// 6. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/carrito', cartRoutes);
app.use('/api/pagos', paymentsRoutes);
app.use('/api/admin', adminRoutes);

// 7. Global Error Handler
app.use(errorHandler);

// 8. Server Initialization & Internal Keep-Alive Fallback
app.listen(PORT, () => {
  console.log(`[SERVER ACTIVE] Platform listening on port ${PORT} in ${process.env.NODE_ENV || 'production'} mode`);

  if (process.env.ENABLE_KEEP_ALIVE_DAEMON === 'true') {
    const PING_TARGET = (process.env.APP_PUBLIC_URL || `http://localhost:${PORT}`) + '/api/health';
    setInterval(async () => {
      try {
        const resp = await fetch(PING_TARGET, {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'KeepAliveInternalDaemon/1.0' }
        });
        if (resp.ok) {
          console.log(`[KEEP-ALIVE INTERNAL] Probe OK at ${new Date().toISOString()}`);
        }
      } catch (err) {
        console.error('[KEEP-ALIVE INTERNAL WARN] Self-ping error:', err.message);
      }
    }, 300000); // 300 seconds = 5 minutes
  }
});
