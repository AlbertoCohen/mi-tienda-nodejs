const { query } = require('../config/database');
const { validateCuitModulo11 } = require('../../../shared/domainEngine');

const ARCA_CUIT_SELLER = process.env.ARCA_CUIT_SELLER || '20409998881';
const ARCA_PTO_VTA = parseInt(process.env.ARCA_PTO_VTA || '1', 10);

function resolveInvoiceType({ taxCondition, cuit }) {
  if (taxCondition === 'Responsable Inscripto' && validateCuitModulo11(cuit)) {
    return { invoiceType: 'A', cbteTipo: 1, docTipo: 80 };
  }
  return { invoiceType: 'B', cbteTipo: 6, docTipo: validateCuitModulo11(cuit) ? 80 : 96 };
}

function generateArcaQrUrl({ cuit, ptoVta, tipoCmp, nroCmp, importe, fecha, codAut }) {
  const qrObj = {
    ver: 1,
    fecha,
    cuit: parseInt(cuit, 10),
    ptoVta: parseInt(ptoVta, 10),
    tipoCmp: parseInt(tipoCmp, 10),
    nroCmp: parseInt(nroCmp, 10),
    importe: Number(parseFloat(importe).toFixed(2)),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: 80,
    nroDocRec: parseInt(cuit, 10),
    tipoCodAut: 'E',
    codAut: parseInt(codAut, 10)
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(qrObj)).toString('base64')}`;
}

async function emitInvoiceForOrder({ orderId, customerData, totalAmount }) {
  const { docNumber, taxCondition } = customerData;
  const { invoiceType, cbteTipo, docTipo } = resolveInvoiceType({ taxCondition, cuit: docNumber });
  const today = new Date();
  const fechaStr = today.toISOString().slice(0, 10);

  const mockCae = '7442' + String(Date.now()).slice(-10);
  const caeDueDate = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const qrUrl = generateArcaQrUrl({
    cuit: ARCA_CUIT_SELLER,
    ptoVta: ARCA_PTO_VTA,
    tipoCmp: cbteTipo,
    nroCmp: 1,
    importe: totalAmount,
    fecha: fechaStr,
    codAut: mockCae
  });

  const res = await query(`
    INSERT INTO fiscal_invoices (
      order_id, is_requested_by_client, invoice_type, doc_type, doc_number,
      pos_number, voucher_number, cae, cae_due_date, afip_barcode, arca_status
    ) VALUES ($1, TRUE, $2, $3, $4, $5, 1, $6, $7, $8, 'AUTHORIZED')
    ON CONFLICT (order_id) DO UPDATE SET
      cae = EXCLUDED.cae,
      arca_status = 'AUTHORIZED',
      afip_barcode = EXCLUDED.afip_barcode
    RETURNING *;
  `, [orderId, invoiceType, docTipo, docNumber, ARCA_PTO_VTA, mockCae, caeDueDate, qrUrl]);

  return res.rows[0];
}

module.exports = { resolveInvoiceType, generateArcaQrUrl, emitInvoiceForOrder };
