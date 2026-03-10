// src/middlewares/errorHandler.js
/*Captura cualquier error del sistema, lo limpia y responde al cliente de 
forma segura (sin mostrar detalles técnicos de tu servidor).*/

const { ZodError } = require('zod');

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    console.error('💥 ERROR:', err);

    // 1. Manejo de Errores de Validación Zod
    if (err instanceof ZodError) {
        return res.status(400).json({
            status: 'fail',
            message: 'Error de validación de datos',
            errors: err.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message
            }))
        });
    }

    // 2. Errores de PostgreSQL (Duplicados)
    if (err.code === '23505') {
        return res.status(409).json({
            status: 'fail',
            message: 'El registro ya existe (dato duplicado).'
        });
    }

    // 3. Respuesta Genérica
    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;