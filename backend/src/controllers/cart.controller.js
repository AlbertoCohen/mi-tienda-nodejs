const CartDAO = require('../daos/cart.dao');
const CartService = require('../services/cart.service');
const catchAsync = require('../utils/catchAsync');

const getCart = catchAsync(async (req, res) => {
    const clienteId = req.query.cliente_id || 1; 

    const carrito = await CartDAO.getCartByClientId(clienteId);
    const items = await CartDAO.getCartItems(carrito.id);

    // [FIX] Cálculo de Total General en el Backend
    const totalCarrito = items.reduce((acc, item) => acc + Number(item.subtotal), 0);

    res.json({
        status: "success",
        data: {
            carrito_id: carrito.id,
            items: items,
            total_items: items.length,
            total_precio: totalCarrito // [FIX] El frontend ahora tiene el total oficial
        }
    });
});

const addToCart = catchAsync(async (req, res) => {
    const { cliente_id, producto_id, variante, cantidad } = req.body;
    const carrito = await CartDAO.getCartByClientId(cliente_id || 1);
    const item = await CartDAO.addItem(carrito.id, producto_id, variante, cantidad);

    res.json({ status: "success", message: "Producto agregado al carrito", data: item });
});

const checkoutCart = catchAsync(async (req, res) => {
    const { cliente_id } = req.body; // En futuro vendrá del token
    
    const resultado = await CartService.procesarCompra(cliente_id || 1);

    res.status(200).json({
        status: "success",
        message: "Compra realizada con éxito",
        data: resultado
    });
});

module.exports = { getCart, addToCart, checkoutCart };