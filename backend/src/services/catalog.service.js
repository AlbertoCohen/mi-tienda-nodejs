import { pool } from '../config/db.js';

let inFlightMenuPromise = null;

export const getPrunedMenuCategories = async ({ estacionCliente, generoCliente, rangoEtario }) => {
  const query = `
    WITH stock_por_producto AS (
      SELECT 
        p.id AS producto_id, p.categoria_id, p.subcategoria_id, SUM(v.stock) AS total_stock
      FROM productos p
      JOIN variantes v ON v.producto_id = p.id
      WHERE p.activo = TRUE 
        AND p.eliminado_en IS NULL 
        AND v.eliminado_en IS NULL
        AND (p.estacion = $1 OR p.estacion = 'Ambas')
        AND (p.genero = $2 OR p.genero = 'Unisex')
        AND ($3::VARCHAR IS NULL OR p.rango_etario = $3 OR p.rango_etario = 'Todos')
      GROUP BY p.id, p.categoria_id, p.subcategoria_id
      HAVING SUM(v.stock) > 0
    )
    SELECT 
      c.id AS categoria_id, c.nombre AS categoria_nombre, c.slug AS categoria_slug,
      json_agg(json_build_object('id', sc.id, 'nombre', sc.nombre, 'slug', sc.slug, 'disponible', sp.total_stock)) AS subcategorias
    FROM stock_por_producto sp
    JOIN categorias c ON c.id = sp.categoria_id
    JOIN subcategorias sc ON sc.id = sp.subcategoria_id
    WHERE c.activo = TRUE AND c.eliminado_en IS NULL
    GROUP BY c.id, c.nombre, c.slug, c.orden
    ORDER BY c.orden ASC;
  `;

  const cacheKey = `${estacionCliente}_${generoCliente}_${rangoEtario || 'all'}`;
  const res = await pool.query(query, [estacionCliente, generoCliente, rangoEtario || null]);
  return res.rows;
};
