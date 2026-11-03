function generateZplThermalLabel({ trackingNumber, orderNumber, providerName, serviceType, recipient, weightKg = 1.5 }) {
  const name = (recipient?.name || recipient?.firstName || 'Destinatario').slice(0, 30);
  const street = (recipient?.address?.street || recipient?.street || 'Domicilio').slice(0, 35);
  const zip = (recipient?.address?.zipCode || recipient?.zipCode || '1000').slice(0, 8);

  return `
^XA
^PW800
^LL1200
^FO20,20^GB760,1160,4^FS
^FO40,50^A0N,45,45^FD${providerName.toUpperCase()}^FS
^FO40,110^A0N,28,28^FDSERVICIO: ${serviceType}^FS
^FO20,160^GB760,2,2^FS
^FO40,180^A0N,26,26^FDDESTINATARIO:^FS
^FO40,220^A0N,36,36^FD${name}^FS
^FO40,270^A0N,28,28^FDDIR: ${street}^FS
^FO40,310^A0N,38,38^FDCP: ${zip}^FS
^FO20,370^GB760,4,4^FS
^FO100,420^BY3,3,140
^BCN,140,Y,N,N,A
^FD${trackingNumber}^FS
^FO40,620^A0N,30,30^FDTRACKING: ${trackingNumber}^FS
^FO40,660^A0N,28,28^FDORDEN REF: ${orderNumber}^FS
^FO40,700^A0N,26,26^FDPESO AFORADO: ${weightKg} KG^FS
^XZ
  `.trim();
}

function generatePrintableLabelHtml({ trackingNumber, orderNumber, providerName, serviceType, recipient }) {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rótulo ${trackingNumber}</title>
<style>body{font-family:monospace;padding:20px;}.box{border:3px solid #000;padding:15px;width:350px;margin:auto;}</style>
</head><body><div class="box">
<h2>${providerName}</h2><p>${serviceType}</p><hr/>
<p><strong>Destino:</strong> ${recipient?.firstName || ''} ${recipient?.lastName || ''}</p>
<p>CP: ${recipient?.address?.zipCode || recipient?.zipCode || '1000'}</p>
<div style="font-size:24px;letter-spacing:5px;margin:20px 0;">||||||||||||||||</div>
<p><strong>${trackingNumber}</strong></p><p>Orden: ${orderNumber}</p>
</div></body></html>`;
}

module.exports = { generateZplThermalLabel, generatePrintableLabelHtml };
