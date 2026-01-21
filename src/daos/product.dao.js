// src/daos/product.dao.js
const db = require('../config/db');

class ProductDAO {
    
    // Obtener todos los productos
    async getAll() {
        try {
            const result = await db.query('SELECT * FROM productos ORDER BY id DESC');
            return result.rows; // En PG, los datos reales están en .rows
        } catch (error) {
            console.error("Error en DAO getAll:", error);
            throw error;
        }
    }

    // Crear producto (Fíjate en los $1, $2 y el RETURNING *)
    async create(nombre, precio, imagenUrl) {
        const sql = `
            INSERT INTO productos (nombre, precio, imagen_url) 
            VALUES ($1, $2, $3) 
            RETURNING *;
        `;
        
        try {
            const result = await db.query(sql, [nombre, precio, imagenUrl]);
            return result.rows[0]; // Devolvemos el producto recién creado
        } catch (error) {
            console.error("Error en DAO create:", error);
            throw error;
        }
    }

    // Obtener por ID
    async getById(id) {
        const sql = 'SELECT * FROM productos WHERE id = $1';
        const result = await db.query(sql, [id]);
        return result.rows[0];
    }

    // Eliminar producto
    async delete(id) {
        const sql = 'DELETE FROM productos WHERE id = $1 RETURNING id';
        const result = await db.query(sql, [id]);
        return result.rowCount > 0; // Devuelve true si borró algo
    }
}

module.exports = new ProductDAO();