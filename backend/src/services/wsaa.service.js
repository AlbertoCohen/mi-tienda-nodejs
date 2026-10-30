import soap from 'soap';
import forge from 'node-forge';
import { pool } from '../config/db.js';

export const getOrRenewWSAATicket = async () => {
  const tokenRes = await pool.query('SELECT token, sign, expira_en FROM arca_wsaa_tokens WHERE id = 1');
  const now = new Date();

  if (tokenRes.rows.length > 0) {
    const { token, sign, expira_en } = tokenRes.rows[0];
    if (new Date(expira_en) > new Date(now.getTime() + 1800000)) { // 30 min buffer
      return { token, sign };
    }
  }

  // Pre-validate certificate
  const cert = forge.pki.certificateFromPem(process.env.ARCA_CERT_X509);
  if (now > cert.validity.notAfter) {
    throw new Error(`Certificado fiscal ARCA expirado el ${cert.validity.notAfter.toISOString()}`);
  }

  const genTime = new Date(now.getTime() - 300000).toISOString().replace(/\.\d+Z$/, '-03:00');
  const expTime = new Date(now.getTime() + 43200000).toISOString().replace(/\.\d+Z$/, '-03:00');

  const traXml = `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${genTime}</generationTime>
    <expirationTime>${expTime}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(traXml, 'utf8');
  p7.addCertificate(process.env.ARCA_CERT_X509);
  p7.addSigner({
    key: process.env.ARCA_PRIVATE_KEY,
    certificate: process.env.ARCA_CERT_X509,
    digestAlgorithm: forge.pki.oids.sha256
  });
  p7.sign();
  const cmsCoded = forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());

  const wsaaClient = await soap.createClientAsync(process.env.ARCA_WSAA_WSDL_URL);
  const [result] = await wsaaClient.loginCmsAsync({ in0: cmsCoded });
  const xml = result.loginCmsReturn;
  const token = xml.match(/<token>(.*?)<\/token>/)[1];
  const sign = xml.match(/<sign>(.*?)<\/sign>/)[1];
  const expiraEn = new Date(now.getTime() + 40000000);

  await pool.query(
    `INSERT INTO arca_wsaa_tokens (id, service, token, sign, expira_en, actualizado_en)
     VALUES (1, 'wsfe', $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE 
     SET token = $1, sign = $2, expira_en = $3, actualizado_en = NOW()`,
    [token, sign, expiraEn]
  );

  return { token, sign };
};
