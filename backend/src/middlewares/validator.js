// src/middlewares/validator.js
/*Protege tu base de datos de datos basura. Si el frontend envía 
un precio negativo o texto donde va un número, esto lo bloquea 
antes de que llegue al controlador.*/

const { ZodError } = require('zod');
const fs = require('fs').promises; // [FIX] Para limpiar archivos huérfanos

// Middleware universal para Zod
const validate = (schema) => {
    return async(req, res, next) => {
        try {   
            // Validamos req.body y lo reemplazamos con los datos parseados/limpios
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            // Pasamos el error al errorHandler global
            // [FIX] Si la validación falla, eliminamos la imagen que Multer ya guardó
            if (req.file && req.file.path) {
                await fs.unlink(req.file.path).catch(() => console.warn("No se pudo limpiar archivo temporal"));
            }
            next(error);
        }
    };
};

module.exports = validate;