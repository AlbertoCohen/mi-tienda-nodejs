const { pool } = require('../config/db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// 1. OBTENER TODAS LAS ÓRDENES (CON DATOS DEL CLIENTE)
const getAllOrders = catchAsync(async (req, res, next) => {
    const query = `
        SELECT 
            o.id,
            o.cliente_id,
            u.email AS cliente_email,
            o.subtotal,
            o.total_final,
            o.estado,
            o.creado_en
        FROM ordenes o
        LEFT JOIN usuarios u ON o.cliente_id = u.id
        ORDER BY o.creado_en DESC
    `;

    const result = await pool.query(query);

    res.status(200).json({
        status: 'success',
        results: result.rows.length,
        data: {
            ordenes: result.rows
        }
    });
});

// 2. ACTUALIZAR ESTADO DE LA ORDEN
const updateOrderStatus = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { estado } = req.body;

    // Validación estricta de la máquina de estados
    const estadosPermitidos = ['PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
    
    if (!estado || !estadosPermitidos.includes(estado)) {
        return next(new AppError(`Estado inválido. Los permitidos son: ${estadosPermitidos.join(', ')}`, 400));
    }

    const query = `
        UPDATE ordenes 
        SET estado = $1 
        WHERE id = $2 
        RETURNING *
    `;
    
    const result = await pool.query(query, [estado, id]);

    if (result.rows.length === 0) {
        return next(new AppError('No se encontró ninguna orden con ese ID', 404));
    }

    // Nota de Arquitectura: Si el estado es 'CANCELADO', aquí a futuro deberíamos 
    // llamar al AdminInventoryService para devolver el stock de los items de esta orden.

    res.status(200).json({
        status: 'success',
        message: `El estado de la orden #${id} fue actualizado a ${estado}`,
        data: {
            orden: result.rows[0]
        }
    });
});

module.exports = {
    getAllOrders,
    updateOrderStatus
};