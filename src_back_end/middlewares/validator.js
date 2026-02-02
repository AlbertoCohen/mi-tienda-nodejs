// src/middlewares/validator.js
/*Protege tu base de datos de datos basura. Si el frontend envía 
un precio negativo o texto donde va un número, esto lo bloquea 
antes de que llegue al controlador.*/

const { z } = require('zod');
const AppError = require('../utils/AppError');

// Esquema de Validación para Productos
const productoSchema = z.object({
    nombre: z.string().min(3, "El nombre debe tener al menos 3 letras"),
    precio: z.coerce.number().positive("El precio debe ser positivo"), // coerce convierte "100" a 100
    genero: z.enum(["hombre", "mujer", "niño", "unisex", "bebe"]).optional(),
    tipo: z.string().optional(),
    temporada: z.enum(["verano", "invierno", "neutro"]).optional(),
    tags: z.string().optional(), // Recibimos JSON stringificado del FormData
    variantes: z.string().optional() // Recibimos JSON stringificado del FormData
});

// Middleware que ejecuta la validación
exports.validarProducto = (req, res, next) => {
    // Si no hay body (raro), pasamos
    if (!req.body) return next();

    // Validamos contra el esquema
    const resultado = productoSchema.safeParse(req.body);

    if (!resultado.success) {
        // Si falla, formateamos el error bonito para el frontend
        const mensajeError = resultado.error.errors.map(e => `${e.path[0]}: ${e.message}`).join(', ');
        return next(new AppError(`Datos inválidos: ${mensajeError}`, 400));
    }
    
    // Si pasa, seguimos
    next();
};