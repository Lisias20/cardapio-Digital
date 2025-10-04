const QRCode = require('qrcode');

async function generateTableQR({ baseUrl, storeSlug, tableId, format = 'png' }) {
  const nonce = Math.random().toString(36).slice(2, 8);
  const url = `${baseUrl}/${storeSlug}/m/${tableId}?t=${nonce}`;
  if (format === 'svg') {
    return await QRCode.toString(url, { type: 'svg', width: 512, errorCorrectionLevel: 'H' });
  }
  const buffer = await QRCode.toBuffer(url, { type: 'png', width: 1024, errorCorrectionLevel: 'H' });
  return buffer;
}

module.exports = { generateTableQR };