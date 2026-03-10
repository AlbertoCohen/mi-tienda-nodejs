const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// 1. GUARDIA DE IDENTIDAD (Autenticación)
const verifyToken = catchAsync(async (req, res, next) => {
    let token;

    // Extraer token del header Authorization (Estándar Bearer)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('No has iniciado sesión. Por favor, provee un token válido para acceder.', 401));
    }

    try {
        // Verificar firma y expiración del token criptográficamente
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Inyectamos la carga útil del token (id, rol, etc.) en la request actual
        // Esto permite que los siguientes middlewares o controladores sepan QUIÉN hace la petición
        req.user = decoded; 
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 401));
        }
        return next(new AppError('Token inválido o corrupto.', 401));
    }
});

// 2. GUARDIA DE PRIVILEGIOS (Autorización RBAC)
const isAdmin = (req, res, next) => {
    // verifyToken debe ejecutarse ANTES que este middleware para que req.user exista
    if (!req.user || req.user.rol !== 'admin') {
        return next(new AppError('Acceso denegado. Se requieren privilegios de administrador (RBAC).', 403));
    }
    
    // Si es admin, lo dejamos pasar al controlador
    next();
};

module.exports = { 
    verifyToken, 
    isAdmin 
};