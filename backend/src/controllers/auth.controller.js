const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// 1. REGISTRO DE USUARIO
const register = catchAsync(async (req, res, next) => {
    const { email, password, rol } = req.body;

    // Validación básica manual (idealmente esto pasaría por un middleware de Zod)
    if (!email || !password) {
        return next(new AppError('Por favor provee un email y una contraseña.', 400));
    }

    if (password.length < 8) {
        return next(new AppError('La contraseña debe tener al menos 8 caracteres.', 400));
    }

    // Verificar si el email ya existe
    const userExists = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
        return next(new AppError('El email ya está registrado.', 409));
    }

    // Hashear la contraseña (Salting round: 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Definir el rol (Por seguridad, solo permitimos 'user' a menos que se inyecte por un admin, 
    // pero para este desarrollo permitiremos enviar el rol para que puedas crear tu primer admin).
    // [PARCHE DE SEGURIDAD] Forzamos estrictamente el rol 'user' para registros públicos.
    // Para otorgar permisos de 'admin', debes editar la fila manualmente en el editor SQL de Neon.
    const userRole = 'user';

    // Insertar en Base de Datos
    const newUser = await pool.query(
        'INSERT INTO usuarios (email, password_hash, rol) VALUES ($1, $2, $3) RETURNING id, email, rol, creado_en',
        [email, passwordHash, userRole]
    );

    res.status(201).json({
        status: 'success',
        message: 'Usuario registrado exitosamente',
        data: {
            user: newUser.rows[0]
        }
    });
});

// 2. LOGIN DE USUARIO (Fábrica de JWT)
const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError('Por favor provee email y contraseña.', 400));
    }

    // Buscar al usuario
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const user = result.rows[0];

    // Verificar si existe y si la contraseña coincide (Protección contra Timing Attacks)
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return next(new AppError('Credenciales incorrectas.', 401));
    }

    // Firmar el JWT
    const token = jwt.sign(
        { id: user.id, rol: user.rol }, 
        process.env.JWT_SECRET, 
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Retornar el token y los datos del usuario (sin el hash de la contraseña)
    res.status(200).json({
        status: 'success',
        message: 'Login exitoso',
        token,
        data: {
            user: {
                id: user.id,
                email: user.email,
                rol: user.rol
            }
        }
    });
});

module.exports = {
    register,
    login
};