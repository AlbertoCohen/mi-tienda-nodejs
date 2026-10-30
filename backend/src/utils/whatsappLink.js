export const generateWhatsAppProductLink = ({ phone, product, variant, storeUrl }) => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const price = product.precio_promocional || product.precio_base;
  const msg = [
    `¡Hola! 👋 Me interesa esta prenda de la tienda:`,
    `▪ *Producto:* ${product.nombre}`,
    `▪ *Talle:* ${variant.talle}`,
    `▪ *Color:* ${variant.color}`,
    `▪ *Precio:* $${Number(price).toLocaleString('es-AR')}`,
    `▪ *Enlace:* ${storeUrl}/producto/${product.slug}?variant=${variant.id}`,
    `¿Tienen stock disponible para envío? Muchas gracias.`
  ].join('\n');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
};

export const generateWhatsAppCartLink = ({ phone, cart, storeUrl }) => {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const itemsText = cart.items
    .map(it => `• ${it.producto_nombre} (Talle: ${it.talle}, Color: ${it.color}) x ${it.cantidad} - $${Number(it.subtotal).toLocaleString('es-AR')}`)
    .join('\n');

  const msg = [
    `¡Hola! 👋 Quisiera consultar sobre los artículos en mi carrito:`,
    itemsText,
    `--------------------------`,
    `*Total:* $${Number(cart.total_final).toLocaleString('es-AR')}`,
    `¿Tienen opciones de retiro o coordinación especial?`
  ].join('\n');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
};
