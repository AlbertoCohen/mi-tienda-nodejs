// src/services/product.service.js
const productDAO = require('../daos/product.dao');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

class ProductService {

    async listarProductos() {
        return await productDAO.getAll();
    }

    async crearProducto(data, filePath) {
        let imagenUrl = null;

        // 1. Si viene un archivo, lo subimos a la nube
        if (filePath) {
            try {
                // Subimos a Cloudinary
                const resultado = await cloudinary.uploader.upload(filePath, {
                    folder: "tienda_online_v1" // Carpeta en tu Cloudinary
                });
                
                // Guardamos la URL segura (https)
                imagenUrl = resultado.secure_url; 
                
                // IMPORTANTE: Borrar el archivo local temporal
                // Si no hacemos esto, el servidor se llenará de basura
                try {
                    fs.unlinkSync(filePath);
                } catch (unlinkError) {
                    console.error("Error borrando archivo temporal:", unlinkError);
                }

            } catch (error) {
                console.error("Error subiendo a Cloudinary:", error);
                // Si falla la subida de imagen, ¿queremos cancelar todo?
                // Por ahora lanzamos error para que no se cree el producto sin foto
                throw new Error("Fallo al subir la imagen a la nube");
            }
        }

        // 2. Guardamos la info en la Base de Datos
        return await productDAO.create(data.nombre, data.precio, imagenUrl);
    }

    async eliminarProducto(id) {
        // Obtenemos el producto para ver si tiene foto y borrarla de la nube
        const producto = await productDAO.getById(id);
        
        if (!producto) {
            throw new Error("Producto no encontrado");
        }

        // (Opcional Avanzado) Aquí podrías agregar lógica para borrar la foto de Cloudinary
        // usando cloudinary.uploader.destroy(...), pero por ahora simplifiquemos.
        
        return await productDAO.delete(id);
    }
}

module.exports = new ProductService();