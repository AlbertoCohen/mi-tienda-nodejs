import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import { setSecureSessionCookies } from '../middlewares/authSecurity.js';

export const register = catchAsync(async (req, res, next) => {
  const { email, password, nombre, telefono } = req.body;
  const hash = await bcrypt.hash(password, 12);

  const isMaster = email.toLowerCase() === (process.env.SUPERADMIN_EMAIL || '').toLowerCase();
  const rol = isMaster ? 'superadmin' : 'user';

  const userRes = await pool.query(
    `INSERT INTO usuarios (email, password_hash, rol, nombre, telefono)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, email, rol, nombre`,
    [email.toLowerCase(), hash, rol, nombre || null, telefono || null]
  );

  const user = userRes.rows[0];
  const { csrfToken } = setSecureSessionCookies(res, user);
  res.status(201).json({ status: 'success', user, csrfToken });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  const userRes = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email.toLowerCase()]);
  if (userRes.rows.length === 0) {
    return next(new AppError('Credenciales incorrectas.', 401));
  }

  const user = userRes.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return next(new AppError('Credenciales incorrectas.', 401));
  }

  const { csrfToken } = setSecureSessionCookies(res, user);
  res.status(200).json({
    status: 'success',
    user: { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
    csrfToken
  });
});

export const logout = catchAsync(async (req, res) => {
  if (req.user?.id) {
    await pool.query('UPDATE usuarios SET token_version = token_version + 1 WHERE id = $1', [req.user.id]);
  }
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
  res.clearCookie('csrf_token', { path: '/' });
  res.status(200).json({ status: 'success', message: 'Sesión finalizada exitosamente.' });
});

export const requestOtp = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
  const otpHash = await bcrypt.hash(rawOtp, 10);
  const expira = new Date(Date.now() + 10 * 60000); // 10 min

  await pool.query(
    `UPDATE usuarios SET otp_hash = $1, otp_expira = $2, intentos_fallidos_otp = 0, bloqueado_hasta = NULL WHERE email = $3`,
    [otpHash, expira, email.toLowerCase()]
  );

  // In production this sends real email. For audit logging:
  res.status(200).json({ status: 'success', message: 'Código de acceso enviado a su correo electrónico.' });
});
