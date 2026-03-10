// src/utils/schemas.js

// Schema para VALIDAR DATOS de Producto
// Usamos 'coerce' para que convierta textos ("5000") a números (5000) automáticamente.
// Esto es OBLIGATORIO cuando usamos multipart/form-data (subida de fotos).
// Esquemas básicos de validación (Joi/Zod simulación manual o estructura para validator)
// Mantenemos esto simple para no introducir dependencias nuevas si no las tienes instaladas,
// pero estructura lista para validar datos de entrada.
const { z } = require('zod');

// --- Esquema de Producto ---
// Validamos los datos que llegan al crear un producto
const productSchema = z.object({
    nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    precio: z.coerce.number().min(0, "El precio no puede ser negativo"), // coerce convierte strings numéricos
    descripcion: z.string().optional().nullable(),
    genero: z.enum(['hombre', 'mujer', 'unisex']).default('unisex'),
    tipo: z.string().default('general'),
    temporada: z.enum(['verano', 'invierno', 'neutro']).default('neutro'),
    stock: z.coerce.number().int().min(0).default(0), // Stock inicial simple
    atributos: z.record(z.any()).optional() // Para JSON flexible
});

// --- Esquema de Venta ---
// Validamos la transacción de compra
const saleSchema = z.object({
    producto_id: z.number().int().positive(),
    cliente_id: z.number().int().optional().nullable(),
    color: z.string().min(1, "El color es obligatorio"),
    talle: z.string().min(1, "El talle es obligatorio"),
    cantidad: z.number().int().min(1, "La cantidad debe ser al menos 1"),
    total: z.number().min(0, "El total no puede ser negativo")
});

// --- Esquema de Carrito (Agregar Item) ---
const cartItemSchema = z.object({
    cliente_id: z.number().int().positive(),
    producto_id: z.number().int().positive(),
    variante: z.string().min(1),
    cantidad: z.number().int().min(1)
});

module.exports = {
    productSchema,
    saleSchema,
    cartItemSchema
};