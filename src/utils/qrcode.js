const QRCode = require('qrcode');

async function generateQR(text, type = 'png') {
  if (type === 'svg') return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M' });
  const dataUrl = await QRCode.toDataURL(text, { errorCorrectionLevel: 'M', scale: 8 });
  // Retorna base64 sem prefixo
  return dataUrl.split(',')[1];
}

module.exports = { generateQR };