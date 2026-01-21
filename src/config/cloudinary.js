// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Verificamos que las credenciales existan (Best Practice para no volverse loco debuggeando)
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    console.warn("⚠️ ADVERTENCIA: Faltan las credenciales de Cloudinary en el archivo .env");
}

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true // Fuerza a usar HTTPS siempre
});

module.exports = cloudinary;