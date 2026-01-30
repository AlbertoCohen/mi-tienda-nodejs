// src/middlewares/upload.js
//Maneja la recepción de archivos temporales.

const multer = require('multer');
const os = require('os');

// Guardamos en /tmp del sistema operativo para máxima compatibilidad
const upload = multer({ 
    dest: os.tmpdir(),
    limits: { fileSize: 5 * 1024 * 1024 } // Límite de 5MB por foto
});

module.exports = upload;