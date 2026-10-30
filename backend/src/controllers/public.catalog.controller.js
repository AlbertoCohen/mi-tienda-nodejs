import { pool } from '../config/db.js';
import { catchAsync } from '../utils/catchAsync.js';
import { getPrunedMenuCategories } from '../services/catalog.service.js';
import { resolveGeoAndEvents } from '../services/geoip.service.js';

export const getCatalog = catchAsync(async (req, res) => {
  const { categoria, subcategoria, genero, rangoEtario, estacion, q, limit = 24, offset = 0 } = req.query;

  let baseQuery = `
    SELECT p.id, p.nombre, p.slug, p.precio_base, p.precio_promocional, p.estacion, p.genero, p.rango_etario,
           c.nombre AS categoria_nombre, sc.nombre AS subcategoria_nombre,
           pi.imagen_url, SUM(v.stock) AS total_stock
    FROM productos p
    JOIN categorias c ON c.id = p.categoria_id
    JOIN subcategorias sc ON sc.id = p.subcategoria_id
    JOIN variantes v ON v.producto_id = p.id
    LEFT JOIN producto_imagenes pi ON pi.producto_id = p.id AND pi.es_portada = TRUE
    WHERE p.activo = TRUE AND p.eliminado_en IS NULL AND v.eliminado_en IS NULL
  `;
  const params = [];

  if (estacion) {
    params.push(estacion);
    baseQuery += ` AND (p.estacion = $${params.length} OR p.estacion = 'Ambas')`;
  }
  if (genero) {
    params.push(genero);
    baseQuery += ` AND (p.genero = $${params.length} OR p.genero = 'Unisex')`;
  }
  if (categoria) {
    params.push(categoria);
    baseQuery += ` AND c.slug = $${params.length}`;
  }

  baseQuery += ` GROUP BY p.id, c.nombre, sc.nombre, pi.imagen_url HAVING SUM(v.stock) > 0 LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

  const result = await pool.query(baseQuery, params);
  res.status(200).json({ products: result.rows });
});

export const getProductDetail = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const pRes = await pool.query(
    `SELECT p.*, c.nombre AS categoria_nombre, sc.nombre AS subcategoria_nombre
     FROM productos p
     JOIN categorias c ON c.id = p.categoria_id
     JOIN subcategorias sc ON sc.id = p.subcategoria_id
     WHERE (p.id::text = $1 OR p.slug = $1) AND p.activo = TRUE AND p.eliminado_en IS NULL`,
    [id]
  );

  if (pRes.rows.length === 0) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }

  const product = pRes.rows[0];
  const vRes = await pool.query('SELECT * FROM variantes WHERE producto_id = $1 AND eliminado_en IS NULL ORDER BY stock DESC', [product.id]);
  const imgRes = await pool.query('SELECT * FROM producto_imagenes WHERE producto_id = $1 ORDER BY orden ASC', [product.id]);

  res.status(200).json({
    ...product,
    variantes: vRes.rows,
    imagenes: imgRes.rows
  });
});

export const getMenuNavigation = catchAsync(async (req, res) => {
  const { estacion = 'Verano', genero = 'Hombre', rangoEtario } = req.query;
  const menu = await getPrunedMenuCategories({
    estacionCliente: estacion,
    generoCliente: genero,
    rangoEtario
  });
  res.status(200).json({ menu });
});

export const getGeoConfig = catchAsync(async (req, res) => {
  const country = req.headers['cf-ipcountry'] || 'AR';
  const config = resolveGeoAndEvents(country, new Date());
  res.status(200).json(config);
});
