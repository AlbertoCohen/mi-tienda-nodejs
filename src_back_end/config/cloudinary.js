// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    console.warn("⚠️ Faltan credenciales de Cloudinary en .env");
}

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

module.exports = cloudinary;