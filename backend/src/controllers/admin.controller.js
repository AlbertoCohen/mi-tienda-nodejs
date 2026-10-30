import { pool } from '../config/db.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const getFinancialReport = catchAsync(async (req, res) => {
  const { agrupacion = 'mes', fechaInicio = '2026-01-01', fechaFin = '2026-12-31' } = req.query;
  const allowed = { dia: 'day', semana: 'week', mes: 'month', anio: 'year' };
  const interval = allowed[agrupacion.toLowerCase()] || 'month';

  const query = `
    SELECT 
      DATE_TRUNC('${interval}', o.creado_en) AS periodo,
      COUNT(DISTINCT o.id) AS total_pedidos,
      SUM(o.subtotal_bruto) AS subtotal_bruto_acumulado,
      SUM(o.monto_descuento) AS descuentos_otorgados,
      SUM(o.costo_envio) AS recaudacion_envios,
      SUM(o.total_neto) AS facturacion_total_cobrada,
      COUNT(c.id) AS comprobantes_arca_emitidos,
      SUM(c.importe_neto) AS base_imponible_fiscal,
      SUM(c.importe_iva) AS debito_fiscal_iva
    FROM ordenes o
    LEFT JOIN arca_comprobantes c ON c.orden_id = o.id AND c.estado = 'AUTORIZADO'
    WHERE o.estado_pago = 'APROBADO' AND o.creado_en >= $1 AND o.creado_en <= $2
    GROUP BY DATE_TRUNC('${interval}', o.creado_en)
    ORDER BY periodo DESC;
  `;

  const rows = await pool.query(query, [fechaInicio, fechaFin]);
  res.status(200).json({ periodos: rows.rows });
});

export const listUsers = catchAsync(async (req, res) => {
  const users = await pool.query('SELECT id, email, rol, nombre, creado_en FROM usuarios ORDER BY creado_en DESC');
  res.status(200).json({ users: users.rows });
});

export const updateRole = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { rol } = req.body;
  if (!['user', 'admin_delegado'].includes(rol)) {
    return next(new AppError('Rol inválido', 400));
  }
  const updateRes = await pool.query(
    'UPDATE usuarios SET rol = $1 WHERE id = $2 RETURNING id, email, rol',
    [rol, id]
  );
  res.status(200).json({ status: 'success', user: updateRes.rows[0] });
});
