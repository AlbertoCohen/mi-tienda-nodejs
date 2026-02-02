// src/daos/product.dao.js
const { query } = require('../config/db');

class ProductDAO {

    /**
     * --- LA SUPER FUNCIÓN "SELECCIONAR" ---
     * Sirve para: Catálogo Cliente, Filtros Admin, Ofertas, Búsquedas y DETALLE DE PRODUCTO.
     * Aplica reglas de negocio: Precios dinámicos, Soft Deletes, Stock total.
     */
    async seleccionar(filtros = {}) {
        let params = [];
        let condiciones = [];
        let contador = 1;

        // SQL Base: Joins necesarios para traer toda la info en una sola consulta
        let sql = `
            SELECT DISTINCT 
                p.*,
                -- Subquery: Suma del stock de todas las variantes
                (SELECT COALESCE(SUM(stock), 0) FROM inventario WHERE producto_id = p.id) as stock_total,
                
                -- Agregamos las etiquetas (tags) como un array de texto
                COALESCE(json_agg(DISTINCT e.nombre) FILTER (WHERE e.id IS NOT NULL), '[]') as tags,

                 -- CÁLCULO DE PRECIO DINÁMICO (Eventos Temporales)
                 -- Si hay un evento activo hoy, aplica el descuento. Si no, precio base.
                p.precio_base * (1 - COALESCE(MAX(
                    CASE 
                        WHEN rp.activo = TRUE 
                             AND (rp.fecha_inicio IS NULL OR rp.fecha_inicio <= NOW()) 
                             AND (rp.fecha_fin IS NULL OR rp.fecha_fin >= NOW())
                        THEN rp.porcentaje_descuento ELSE 0 END
                ), 0) / 100.0) as precio_final,

                -- Nombre del evento activo (para mostrar "OFERTA NAVIDAD" en el front)
                MAX(CASE 
                    WHEN rp.activo = TRUE AND rp.fecha_inicio <= NOW() 
                    THEN rp.nombre_evento ELSE NULL END
                ) as evento_activo

            FROM productos p
            LEFT JOIN inventario i ON p.id = i.producto_id
            LEFT JOIN producto_etiquetas pe ON p.id = pe.producto_id
            LEFT JOIN etiquetas e ON pe.etiqueta_id = e.id
            LEFT JOIN reglas_precio rp ON e.id = rp.etiqueta_id
        `;

        // --- REGLA DE ORO: IGNORAR PRODUCTOS BORRADOS (Soft Delete) ---
        condiciones.push(`p.deleted_at IS NULL`);

        // --- FILTROS DINÁMICOS ---

        // 1. Filtro por ID (Nuevo: Para usar en detalle de producto)
        if (filtros.id) {
            condiciones.push(`p.id = $${contador}`);
            params.push(filtros.id);
            contador++;
        }

        // 2. Filtro Nombre (Búsqueda parcial e insensible a mayúsculas)
        if (filtros.nombre) {
            condiciones.push(`p.nombre ILIKE $${contador}`);
            params.push(`%${filtros.nombre}%`);
            contador++;
        }

        // 3. Filtro Talle (Busca en tabla hija Inventario)
        if (filtros.talle) {
            condiciones.push(`i.talle = $${contador}`);
            params.push(filtros.talle);
            contador++;
        }

        // 4. Filtro Etiqueta (Ej: 'navidad', 'oferta')
        if (filtros.tag) {
            condiciones.push(`e.nombre = $${contador}`);
            params.push(filtros.tag);
            contador++;
        }

        // 5. Filtro Temporada (Lógica: Verano incluye Neutro)
        if (filtros.temporada) {
            condiciones.push(`(p.temporada = $${contador} OR p.temporada = 'neutro')`);
            params.push(filtros.temporada);
            contador++;
        }

        // --- UNIÓN DE CONDICIONES ---
        if (condiciones.length > 0) {
            sql += ' WHERE ' + condiciones.join(' AND ');
        }

        // Agrupamos por ID de producto (necesario por los JOINS)
        sql += ' GROUP BY p.id ORDER BY p.id DESC';

        // --- PAGINACIÓN (Solo si no buscamos por ID) ---
        if (!filtros.id) {
            const page = (filtros.page && filtros.page > 0) ? parseInt(filtros.page) : 1;
            const limit = (filtros.limit && filtros.limit > 0) ? parseInt(filtros.limit) : 20;
            const offset = (page - 1) * limit;

            sql += ` LIMIT $${contador} OFFSET $${contador + 1}`;
            params.push(limit, offset);
        }

        const result = await query(sql, params);
        return result.rows;
    }

    // --- MÉTODOS DE ESCRITURA (ADMIN) ---

    async create(data, imagenUrl) {
        // data.atributos debe ser JSON string. Si no, objeto vacío.
        const atributos = data.atributos ? JSON.stringify(data.atributos) : '{}';
        
        // Defaults seguros
        const genero = data.genero || 'unisex';
        const tipo = data.tipo || 'general';
        const temporada = data.temporada || 'neutro';

        // 1. Insertar Producto (CORREGIDO: usa precio_base)
        const sqlProd = `
            INSERT INTO productos (nombre, precio_base, genero, tipo, temporada, imagen_url, descripcion, atributos) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *;
        `;

        console.log("---------------- ALERTA DE DEBUG ----------------");
        console.log("SQL QUE SE ESTÁ EJECUTANDO:", sqlProd);
        console.log("-------------------------------------------------");
        
        const resProd = await query(sqlProd, [
            data.nombre, 
            data.precio, // El frontend manda 'precio', nosotros lo guardamos en 'precio_base'
            genero, 
            tipo, 
            temporada, 
            imagenUrl, 
            data.descripcion, 
            atributos
        ]);
        const producto = resProd.rows[0];

        // 2. Guardar Variantes (Inventario)
        if (data.variantes) {
            try {
                const variantes = typeof data.variantes === 'string' ? JSON.parse(data.variantes) : data.variantes;
                for (const v of variantes) {
                    await query(
                        'INSERT INTO inventario (producto_id, color, talle, stock) VALUES ($1, $2, $3, $4)',
                        [producto.id, v.color, v.talle, v.stock]
                    );
                }
            } catch (e) { console.error("Error guardando variantes:", e); }
        }
        
        // 3. Guardar Etiquetas (Tags)
        if (data.tags) {
            try {
                 const tags = typeof data.tags === 'string' ? JSON.parse(data.tags) : data.tags;
                 for (const tagName of tags) {
                    // Buscar si existe el tag, si no, crearlo
                    let tagRes = await query(`SELECT id FROM etiquetas WHERE nombre = $1`, [tagName]);
                    let tagId;
                    if(tagRes.rows.length === 0) {
                        const newTag = await query(`INSERT INTO etiquetas (nombre) VALUES ($1) RETURNING id`, [tagName]);
                        tagId = newTag.rows[0].id;
                    } else { tagId = tagRes.rows[0].id; }
                    
                    // Asociar al producto (ON CONFLICT DO NOTHING evita errores si ya está asociado)
                    await query(`INSERT INTO producto_etiquetas (producto_id, etiqueta_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [producto.id, tagId]);
                 }
            } catch (e) { console.error("Error guardando tags:", e); }
        }

        return producto;
    }

    // --- SOFT DELETE (Borrado Seguro) ---
    async delete(id) {
        // No borramos la fila, solo marcamos 'deleted_at'
        const sql = 'UPDATE productos SET deleted_at = NOW() WHERE id = $1 RETURNING id';
        const result = await query(sql, [id]);
        return result.rowCount > 0;
    }
    
    // --- DETALLE DE PRODUCTO (Mejorado) ---
    async getById(id) {
        // REUTILIZAMOS LA LÓGICA DE 'seleccionar'
        // Esto asegura que en el detalle también se vea el precio con descuento si hay evento.
        const productos = await this.seleccionar({ id: id });
        
        if (!productos || productos.length === 0) return null;
        
        const prod = productos[0];
        
        // Traer inventario detallado (Esto 'seleccionar' no lo trae desglosado, solo suma el total)
        const invRes = await query(`SELECT color, talle, stock FROM inventario WHERE producto_id = $1`, [id]);
        prod.variantes = invRes.rows;
        
        // Contar vista
        await query('UPDATE productos SET vistas = vistas + 1 WHERE id = $1', [id]);
        
        return prod;
    }

    // --- CONFIGURACIÓN GLOBAL ---
    async getConfig(clave) {
        const res = await query('SELECT valor FROM configuraciones WHERE clave = $1', [clave]);
        return res.rows[0] ? res.rows[0].valor : null;
    }

    async updateConfig(clave, valor) {
        await query(
            'INSERT INTO configuraciones (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = $2',
            [clave, valor]
        );
    }
}

module.exports = new ProductDAO();