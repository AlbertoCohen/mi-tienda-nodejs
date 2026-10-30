import { pool } from '../config/db.js';
import { emitirFacturaCompletaARCA } from '../services/arca.service.js';

export const runOutboxWorker = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimRes = await client.query(`
      SELECT id, orden_id, payload, intentos 
      FROM arca_outbox 
      WHERE estado = 'PENDING' AND proximo_intento <= NOW() 
      ORDER BY creado_en ASC 
      FOR UPDATE SKIP LOCKED LIMIT 1
    `);

    if (claimRes.rows.length === 0) {
      await client.query('COMMIT');
      return;
    }

    const task = claimRes.rows[0];
    await client.query(`UPDATE arca_outbox SET estado = 'PROCESSING', actualizado_en = NOW() WHERE id = $1`, [task.id]);
    await client.query('COMMIT');

    try {
      const res = await emitirFacturaCompletaARCA(pool, {
        ordenId: task.orden_id,
        ...task.payload
      });

      await pool.query(`UPDATE arca_outbox SET estado = 'COMPLETED', ultimo_error = NULL WHERE id = $1`, [task.id]);
      await pool.query(
        `INSERT INTO arca_comprobantes 
         (orden_id, punto_venta, tipo_comprobante, numero_comprobante, cuit_emisor, doc_tipo, doc_nro, cae, cae_vto, importe_total, importe_neto, importe_iva, alicuotas_iva, qr_data, estado, resultado_arca)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_date($9, 'YYYYMMDD'), $10, $11, $12, $13, $14, 'AUTORIZADO', 'A')`,
        [
          task.orden_id, task.payload.puntoVta, task.payload.cbteTipo, res.cbteNro,
          process.env.ARCA_CUIT_EMISOR, task.payload.docTipo, task.payload.docNro,
          res.cae, res.caeVto, res.importeTotal, res.importeNeto, res.importeIva,
          JSON.stringify(res.alicuotas), res.qrData
        ]
      );
    } catch (err) {
      const nextAttempt = task.intentos + 1;
      const backoffSec = Math.pow(2, nextAttempt) * 30;
      const status = nextAttempt >= 5 ? 'FAILED' : 'PENDING';
      await pool.query(
        `UPDATE arca_outbox SET estado = $1, intentos = $2, proximo_intento = NOW() + ($3 || ' seconds')::interval, ultimo_error = $4 WHERE id = $5`,
        [status, nextAttempt, backoffSec, err.message, task.id]
      );
    }
  } catch (err) {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
};

if (process.argv[1]?.includes('arcaOutbox.worker.js')) {
  setInterval(runOutboxWorker, 10000);
}
