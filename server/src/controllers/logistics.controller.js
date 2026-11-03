const { query } = require('../config/database');
const { getShippingStrategy } = require('../services/logistics/shippingStrategy');
const { generateZplThermalLabel, generatePrintableLabelHtml } = require('../services/logistics/zplLabelGenerator');

async function quoteShipping(req, res) {
  try {
    const { destinationZip, items = [] } = req.body;
    const provs = await query(`SELECT code FROM shipping_providers WHERE is_active = TRUE`);
    const quotes = [];
    for (const p of provs.rows) {
      const strat = getShippingStrategy(p.code);
      const q = await strat.quote({ destinationZip, items });
      quotes.push(...q);
    }
    return res.status(200).json({ quotes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function dispatchOrderShipment(req, res) {
  try {
    const { orderId, providerCode = 'ANDREANI' } = req.body;
    const existing = await query(`SELECT * FROM shipments WHERE order_id = $1`, [orderId]);
    if (existing.rowCount > 0) return res.status(200).json(existing.rows[0]);

    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Orden no encontrada.' });

    const providerRes = await query(`SELECT id, code, name FROM shipping_providers WHERE code = $1`, [providerCode]);
    const strat = getShippingStrategy(providerCode);
    const ship = await strat.createShipment({ orderId });

    const zpl = generateZplThermalLabel({
      trackingNumber: ship.trackingNumber,
      orderNumber: orderRes.rows[0].order_number,
      providerName: providerRes.rows[0].name,
      serviceType: ship.serviceType,
      recipient: orderRes.rows[0].shipping_address
    });
    const zplBase64 = Buffer.from(zpl).toString('base64');

    const inserted = await query(`
      INSERT INTO shipments (order_id, provider_id, tracking_number, service_type, status, declared_value, zpl_label_base64)
      VALUES ($1, $2, $3, $4, 'ready_to_ship', $5, $6) RETURNING *;
    `, [orderId, providerRes.rows[0].id, ship.trackingNumber, ship.serviceType, orderRes.rows[0].total, zplBase64]);

    return res.status(201).json(inserted.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function printLabel(req, res) {
  try {
    const { trackingNumber } = req.params;
    const ship = await query(`
      SELECT s.*, sp.name AS provider_name, o.order_number, o.shipping_address
      FROM shipments s JOIN shipping_providers sp ON sp.id = s.provider_id
      JOIN orders o ON o.id = s.order_id WHERE s.tracking_number = $1
    `, [trackingNumber]);

    if (ship.rowCount === 0) return res.status(404).send('Rótulo no encontrado');
    const s = ship.rows[0];

    if (req.query.format === 'html') {
      return res.send(generatePrintableLabelHtml({
        trackingNumber: s.tracking_number,
        orderNumber: s.order_number,
        providerName: s.provider_name,
        serviceType: s.service_type,
        recipient: s.shipping_address
      }));
    }
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="label_${trackingNumber}.zpl"`);
    return res.send(Buffer.from(s.zpl_label_base64, 'base64').toString('utf8'));
  } catch (err) {
    return res.status(500).send(err.message);
  }
}

module.exports = { quoteShipping, dispatchOrderShipment, printLabel };
