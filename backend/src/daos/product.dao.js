const { query, pool } = require('../config/db');

class ProductDAO {

    async seleccionar(filtros = {}) {
        let params = [];
        let condiciones = [];
        let contador = 1;
        
        const filtraPorTalle = !!filtros.talle;
        const filtraPorTag = !!filtros.tag;

        let sql = `
            SELECT 
                p.*,
                (SELECT COALESCE(SUM(stock), 0) FROM inventario WHERE producto_id = p.id) as stock_total,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object('id', i.id, 'color', i.color, 'talle', i.talle, 'stock', i.stock, 'sku', i.sku)
                    ) FROM inventario i WHERE i.producto_id = p.id),
                '[]') as variantes,
                COALESCE(
                    (SELECT json_agg(e.nombre) 
                     FROM producto_etiquetas pe 
                     JOIN etiquetas e ON pe.etiqueta_id = e.id 
                     WHERE pe.producto_id = p.id), 
                '[]') as tags
            FROM productos p
        `;

        if (filtraPorTalle) sql += ` JOIN inventario i ON p.id = i.producto_id `;
        if (filtraPorTag) {
             sql += ` 
                JOIN producto_etiquetas pe_filtro ON p.id = pe_filtro.producto_id
                JOIN etiquetas e_filtro ON pe_filtro.etiqueta_id = e_filtro.id
             `;
        }

        condiciones.push(`p.deleted_at IS NULL`);
        condiciones.push(`p.activo = TRUE`);

        if (filtros.id) { condiciones.push(`p.id = $${contador++}`); params.push(filtros.id); }
        if (filtros.nombre) { condiciones.push(`p.nombre ILIKE $${contador++}`); params.push(`%${filtros.nombre}%`); }
        if (filtros.temporada) { 
            condiciones.push(`(p.temporada = $${contador++} OR p.temporada = 'neutro')`); 
            params.push(filtros.temporada); 
        }

        if (condiciones.length > 0) sql += ' WHERE ' + condiciones.join(' AND ');

        sql += ' GROUP BY p.id ORDER BY p.id DESC';

        if (!filtros.id) {
            const page = (filtros.page && filtros.page > 0) ? parseInt(filtros.page) : 1;
            const limit = (filtros.limit && filtros.limit > 0) ? parseInt(filtros.limit) : 20;
            const offset = (page - 1) * limit;
            sql += ` LIMIT $${contador++} OFFSET $${contador++}`;
            params.push(limit, offset);
        }

        const result = await query(sql, params);
        return result.rows;
    }

    async create(data, imagenUrl) {
        const safeData = data || {};
        const atributos = safeData.atributos ? JSON.stringify(safeData.atributos) : '{}';

        // Insertamos solo en productos (sin stock)
        const query = `
            INSERT INTO productos 
            (nombre, precio_base, imagen_url, descripcion, genero, tipo, temporada, atributos)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const values = [
            safeData.nombre, 
            safeData.precio, 
            imagenUrl, 
            safeData.descripcion || null,
            safeData.genero || 'unisex',
            safeData.tipo || 'general',
            safeData.temporada || 'neutro',
            atributos
        ];

        // [FIX] Usamos el client transaccional si existe, de lo contrario el pool
        const executor = client || pool; 
        const { rows } = await executor.query(query, values);
        return rows[0];
    }

    async delete(id) {
        const sql = 'UPDATE productos SET deleted_at = NOW(), activo = FALSE WHERE id = $1 RETURNING id';
        const result = await query(sql, [id]);
        return result.rowCount > 0;
    }

    async getAll(filtros) { return this.seleccionar(filtros); }
    async getById(id) { const res = await this.seleccionar({ id }); return res[0]; }
    
    async getConfig(clave) {
        const res = await query('SELECT valor FROM configuraciones WHERE clave = $1', [clave]);
        return res.rows[0] ? res.rows[0].valor : null;
    }
}

module.exports = new ProductDAO();