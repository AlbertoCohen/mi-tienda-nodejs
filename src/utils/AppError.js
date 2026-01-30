// src/utils/AppError.js
//Esta clase nos permite lanzar errores con código de estado HTTP (ej: 404, 400) de forma limpia.
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Marca el error como "conocido" (no es un bug de código)

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;