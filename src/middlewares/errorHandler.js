// src/middlewares/errorHandler.js
/*Captura cualquier error del sistema, lo limpia y responde al cliente de 
forma segura (sin mostrar detalles técnicos de tu servidor).*/

const AppError = require('../utils/AppError');

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log para el desarrollador (Visible en el dashboard de Render)
    console.error('💥 ERROR CAPTURADO:', err);

    // Respuesta segura para el cliente
    res.status(err.statusCode).json({
        status: err.status,
        message: err.isOperational ? err.message : 'Algo salió mal en el servidor. Intenta más tarde.'
    });
};