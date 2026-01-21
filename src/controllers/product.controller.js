// src/controllers/product.controller.js
const productService = require('../services/product.service');

class ProductController {

    // GET /api/productos
    async getProductos(req, res) {
        try {
            const productos = await productService.listarProductos();
            res.json(productos);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Error al obtener productos" });
        }
    }

    // POST /api/admin/nuevo
    async createProducto(req, res) {
        try {
            const { nombre, precio } = req.body;
            // Multer guarda el archivo y pone la info en req.file
            const filePath = req.file ? req.file.path : null;

            if (!nombre || !precio) {
                return res.status(400).json({ error: "Nombre y precio son obligatorios" });
            }

            const nuevoProducto = await productService.crearProducto({ nombre, precio }, filePath);
            res.status(201).json(nuevoProducto);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }

    // DELETE /api/admin/eliminar/:id
    async deleteProducto(req, res) {
        try {
            const { id } = req.params;
            await productService.eliminarProducto(id);
            res.json({ message: "Producto eliminado correctamente" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new ProductController();