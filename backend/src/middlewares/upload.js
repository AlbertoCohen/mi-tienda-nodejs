import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'tienda-ecommerce/productos',
    allowed_formats: ['jpg', 'png', 'webp', 'avif'],
    transformation: [{ width: 1200, height: 1600, crop: 'limit', quality: 'auto' }]
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
