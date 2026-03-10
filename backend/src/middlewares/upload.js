    // Maneja la recepción de archivos temporales ANTES de subirlos a la nube.

    const multer = require('multer');
    const path = require('path');
    const AppError = require('../utils/AppError');
    const os = require('os'); // [FIX] Dependencia nativa requerida

    // --- CAMBIO 1: Configuración de Almacenamiento Detallada ---
    // Antes usabas 'dest: os.tmpdir()'. Eso es rápido, pero quita el nombre y la extensión.
    // Ahora usamos 'diskStorage' para controlar CÓMO se guarda.
    const storage = multer.diskStorage({
        // 1. Dónde guardar: Seguimos usando el temp del sistema (Perfecto para Render)
        destination: function (req, file, cb) {
            cb(null, os.tmpdir());
        },
        // 2. Qué nombre ponerle: [NUEVO]
        filename: function (req, file, cb) {
            // Generamos un nombre único: "imagen-123456789.jpg"
            // Esto ayuda a que Cloudinary sepa qué tipo de archivo es por la extensión.
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    });

    // --- CAMBIO 2: Filtro de Seguridad ---
    // [NUEVO] Esto evita que suban archivos que NO sean imágenes.
    const fileFilter = (req, file, cb) => {
        // Verificamos el "MIME type" (ej: image/jpeg, image/png, application/pdf)
        if (file.mimetype.startsWith('image/')) {
            cb(null, true); // Aceptado
        } else {
            // Rechazado con error explicativo
            cb(new Error('¡Archivo no válido! Por favor sube solo imágenes (JPG, PNG, WEBP).'), false);
        }
    };

    // Configuración final de Multer
    const upload = multer({ 
        storage: storage,      // Usamos la config detallada de arriba
        fileFilter: fileFilter, // Activamos el filtro de seguridad
        limits: { fileSize: 5 * 1024 * 1024 } // 5MB (Igual que tenías)
    });

    module.exports = upload;