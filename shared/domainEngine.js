function moneyRound(amount) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function validateCuitModulo11(cuit) {
  if (!cuit) return false;
  const clean = String(cuit).replace(/\D/g, '');
  if (clean.length !== 11) return false;
  const validPrefixes = ['20', '23', '24', '27', '30', '33', '34'];
  if (!validPrefixes.includes(clean.substring(0, 2))) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let accumulated = 0;
  for (let i = 0; i < 10; i++) accumulated += parseInt(clean[i], 10) * weights[i];
  const mod = accumulated % 11;
  const expected = mod === 0 ? 0 : mod === 1 ? (clean.startsWith('20') ? 9 : 4) : 11 - mod;
  return expected === parseInt(clean[10], 10);
}

function calculatePromotionDiscount({ promo, items = [], subtotal, currentYear = 2026 }) {
  if (!promo || !promo.is_active) return { discountAmount: 0, finalSubtotal: moneyRound(subtotal) };
  const sub = moneyRound(subtotal);
  let discount = 0;

  switch (promo.promo_type) {
    case 'PATRIOTIC': {
      const years = Math.max(0, currentYear - (promo.independence_year || 1816));
      const pct = Math.min(years, parseFloat(promo.discount_percentage) || 25);
      if (sub >= parseFloat(promo.min_purchase_amount || 0)) discount = sub * (pct / 100);
      break;
    }
    case 'VALENTINE': {
      const damaTotal = items
        .filter(i => i.target_gender === 'mujer_dama' || (i.categoryName || '').toLowerCase().includes('camperita') || (i.categoryName || '').toLowerCase().includes('tapado'))
        .reduce((acc, i) => acc + (parseFloat(i.unitPrice) * (i.quantity || 1)), 0);
      discount = damaTotal * (parseFloat(promo.discount_percentage || 20) / 100);
      break;
    }
    case 'MIN_PURCHASE': {
      if (sub >= parseFloat(promo.min_purchase_amount || 100000)) {
        discount = sub * (parseFloat(promo.discount_percentage || 15) / 100);
      }
      break;
    }
    case 'ABANDONED_CART':
    case 'COUPON': {
      discount = sub * (parseFloat(promo.discount_percentage || 10) / 100);
      break;
    }
  }

  const finalDiscount = moneyRound(Math.min(discount, sub));
  return {
    promoCode: promo.code,
    promoType: promo.promo_type,
    discountAmount: finalDiscount,
    finalSubtotal: moneyRound(Math.max(0, sub - finalDiscount))
  };
}

module.exports = { moneyRound, validateCuitModulo11, calculatePromotionDiscount };
