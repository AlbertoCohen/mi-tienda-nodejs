import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AppError } from '../utils/AppError.js';
import { pool } from '../config/db.js';

export const setSecureSessionCookies = (res, user) => {
  const accessToken = jwt.sign(
    { id: user.id, rol: user.rol, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, tokenVersion: user.token_version || 1 },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/'
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh'
  });

  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });

  return { csrfToken, accessToken };
};

export const verifyToken = async (req, res, next) => {
  let token = req.cookies?.access_token;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('No autenticado. Por favor inicie sesión.', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userRes = await pool.query('SELECT id, email, rol, token_version FROM usuarios WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) {
      return next(new AppError('La cuenta ya no existe.', 401));
    }
    req.user = userRes.rows[0];
    next();
  } catch (err) {
    return next(new AppError('Token de acceso inválido o expirado.', 401));
  }
};

export const verifyAdmin = (req, res, next) => {
  if (!req.user || (req.user.rol !== 'admin_delegado' && req.user.rol !== 'superadmin')) {
    return next(new AppError('Acceso denegado. Se requieren permisos de administrador.', 403));
  }
  next();
};

export const verifySuperAdminOnly = (req, res, next) => {
  if (!req.user || req.user.rol !== 'superadmin' || req.user.email !== process.env.SUPERADMIN_EMAIL) {
    return next(new AppError('Acceso restringido exclusivamente al SuperAdmin maestro.', 403));
  }
  next();
};
