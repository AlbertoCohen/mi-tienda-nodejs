function calculateAforadoWeight(items = []) {
  let realKg = 0;
  let volCm3 = 0;
  for (const it of items) {
    const q = it.quantity || 1;
    const cat = (it.categoryName || '').toLowerCase();
    if (cat.includes('tapado') || cat.includes('campera') || cat.includes('piloto')) {
      realKg += 1.8 * q; volCm3 += 18900 * q;
    } else if (cat.includes('calzado') || cat.includes('zapatilla')) {
      realKg += 1.1 * q; volCm3 += 13125 * q;
    } else {
      realKg += 0.3 * q; volCm3 += 1800 * q;
    }
  }
  const volKg = volCm3 / 5000;
  return { billableWeightKg: Number(Math.max(realKg, volKg).toFixed(2)) };
}

function calculateZonePrice(zipNumeric, billableWeight) {
  const cp = parseInt(zipNumeric, 10) || 1000;
  let base = 3800;
  let days = 2;
  if (cp >= 1000 && cp <= 1499) { base = 3800; days = 1; }
  else if (cp >= 1600 && cp <= 1999) { base = 4900; days = 2; }
  else { base = 6800; days = 4; }
  return { price: Math.round(base + (Math.max(0, billableWeight - 1) * 1200)), days };
}

class AndreaniStrategy {
  async quote({ destinationZip, items }) {
    const { billableWeightKg } = calculateAforadoWeight(items);
    const { price, days } = calculateZonePrice(destinationZip, billableWeightKg);
    return [
      { providerCode: 'ANDREANI', serviceName: 'Andreani Estándar', serviceType: 'ANDREANI_STD', cost: price, estimatedDays: days },
      { providerCode: 'ANDREANI', serviceName: 'Andreani Urgente', serviceType: 'ANDREANI_EXP', cost: Math.round(price * 1.4), estimatedDays: Math.max(1, days - 1) }
    ];
  }
  async createShipment({ orderId }) {
    return { providerCode: 'ANDREANI', trackingNumber: 'AND' + Date.now() + 'AR', serviceType: 'ANDREANI_STD', status: 'ready_to_ship' };
  }
}

class CorreoArgentinoStrategy {
  async quote({ destinationZip, items }) {
    const { billableWeightKg } = calculateAforadoWeight(items);
    const { price, days } = calculateZonePrice(destinationZip, billableWeightKg);
    return [
      { providerCode: 'CORREO_ARGENTINO', serviceName: 'Correo Argentino PAQ.AR Clásico', serviceType: 'PAQ_AR_CLASICO', cost: Math.round(price * 0.9), estimatedDays: days + 1 }
    ];
  }
  async createShipment({ orderId }) {
    return { providerCode: 'CORREO_ARGENTINO', trackingNumber: 'CP' + Date.now().toString().slice(-8) + 'AR', serviceType: 'PAQ_AR_CLASICO', status: 'ready_to_ship' };
  }
}

function getShippingStrategy(code) {
  if (code === 'CORREO_ARGENTINO') return new CorreoArgentinoStrategy();
  return new AndreaniStrategy();
}

module.exports = { calculateAforadoWeight, getShippingStrategy };
