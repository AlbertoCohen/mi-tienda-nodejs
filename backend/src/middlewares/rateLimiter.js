import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';

const generateCompositeKey = (req) => {
  const sessionToken = req.cookies?.['tienda_anon_session_id'] || 
                       req.cookies?.['access_token'] || 
                       req.headers['x-session-id'];

  if (sessionToken) {
    return `session_${crypto.createHash('sha256').update(String(sessionToken)).digest('hex')}`;
  }

  const raw = `${req.ip}_${req.headers['user-agent'] || ''}_${req.headers['sec-ch-ua-platform'] || ''}`;
  return `guest_${crypto.createHash('sha256').update(raw).digest('hex')}`;
};

export const catalogRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: generateCompositeKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Ha superado el límite de peticiones de navegación. Intente en un minuto.' }
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: generateCompositeKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de acceso o compra. Bloqueado temporalmente por 15 minutos.' }
});
