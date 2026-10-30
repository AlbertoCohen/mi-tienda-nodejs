import soap from 'soap';
import { getOrRenewWSAATicket } from './wsaa.service.js';

export const emitirFacturaCompletaARCA = async (pool, { puntoVta, cbteTipo, docTipo, docNro, items, comprobanteAsociado }) => {
  const { token, sign } = await getOrRenewWSAATicket();
  const wsfeClient = await soap.createClientAsync(process.env.ARCA_WSFE_WSDL_URL);

  const authHeader = {
    Token: token,
    Sign: sign,
    Cuit: process.env.ARCA_CUIT_EMISOR
  };

  const [ultimoRes] = await wsfeClient.FECompUltimoAutorizadoAsync({
    Auth: authHeader,
    PtoVta: puntoVta,
    CbteTipo: cbteTipo
  });
  const proximoCbte = Number(ultimoRes.FECompUltimoAutorizadoResult.CbteNro) + 1;

  let subtotalNeto = 0;
  let subtotalIva = 0;

  for (const it of items) {
    const netoUnit = Math.round((Number(it.precio_unitario) / 1.21) * 100) / 100;
    const netoTotal = Math.round(netoUnit * it.cantidad * 100) / 100;
    const ivaTotal = Math.round(netoTotal * 0.21 * 100) / 100;
    subtotalNeto += netoTotal;
    subtotalIva += ivaTotal;
  }

  const total = Math.round((subtotalNeto + subtotalIva) * 100) / 100;
  const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const alicIva = [{ Id: 5, BaseImp: subtotalNeto, Importe: subtotalIva }];

  const detReq = {
    Concepto: 1,
    DocTipo: docTipo,
    DocNro: docNro,
    CbteDesde: proximoCbte,
    CbteHasta: proximoCbte,
    CbteFch: fechaHoy,
    ImpTotal: total,
    ImpTotConc: 0.00,
    ImpNeto: subtotalNeto,
    ImpOpEx: 0.00,
    ImpTrib: 0.00,
    ImpIVA: subtotalIva,
    MonId: 'PES',
    MonCotiz: 1.00,
    CondicionIvaReceptorId: docTipo === 80 ? 1 : 5
  };

  if (cbteTipo !== 11) {
    detReq.Iva = { AlicIva: alicIva };
  }

  if (comprobanteAsociado) {
    detReq.CbtesAsoc = {
      CbteAsoc: [{
        Tipo: comprobanteAsociado.tipo,
        PtoVta: comprobanteAsociado.ptoVta,
        Nro: comprobanteAsociado.nro,
        Cuit: comprobanteAsociado.cuit || process.env.ARCA_CUIT_EMISOR
      }]
    };
  }

  try {
    const [res] = await wsfeClient.FECAESolicitarAsync({
      Auth: authHeader,
      FeCAEReq: {
        FeCabReq: { CantReg: 1, PtoVta: puntoVta, CbteTipo: cbteTipo },
        FeDetReq: { FECAEDetRequest: [detReq] }
      }
    });

    const resp = res.FECAESolicitarResult.FeDetResp.FECAEDetResponse[0];
    if (resp.Resultado === 'A') {
      const qrJson = JSON.stringify({
        ver: 1,
        fecha: fechaHoy,
        cuit: Number(process.env.ARCA_CUIT_EMISOR),
        ptoVta: puntoVta,
        tipoCmp: cbteTipo,
        nroCmp: proximoCbte,
        importe: total,
        moneda: 'PES',
        ctz: 1,
        tipoDocRec: docTipo,
        nroDocRec: docNro,
        tipoCodAut: 'E',
        codAut: Number(resp.CAE)
      });
      const qrData = `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(qrJson).toString('base64')}`;

      return {
        cae: resp.CAE,
        caeVto: resp.CAEFchVto,
        cbteNro: proximoCbte,
        importeTotal: total,
        importeNeto: subtotalNeto,
        importeIva: subtotalIva,
        alicuotas: alicIva,
        qrData
      };
    } else {
      throw new Error(`Rechazo ARCA: ${JSON.stringify(resp.Observaciones)}`);
    }
  } catch (err) {
    // Timeout recovery with FECompConsultar
    const [consult] = await wsfeClient.FECompConsultarAsync({
      Auth: authHeader,
      FeCompConsReq: { PtoVta: puntoVta, CbteTipo: cbteTipo, CbteNro: proximoCbte }
    });
    const info = consult?.FECompConsultarResult?.ResultGet;
    if (info && info.CodAutorizacion) {
      return {
        cae: info.CodAutorizacion,
        caeVto: info.FchVto,
        cbteNro: proximoCbte,
        importeTotal: total,
        importeNeto: subtotalNeto,
        importeIva: subtotalIva,
        alicuotas: alicIva,
        qrData: ''
      };
    }
    throw err;
  }
};
