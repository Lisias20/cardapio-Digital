const mercadopago = require('mercadopago');
const config = require('../config');

mercadopago.configure({
  access_token: config.mp.accessToken
});

function externalReferenceFor(order) {
  return `order:${order.publicId};store:${order.storeId}`;
}

async function createPixPayment({ order, payer = {} }) {
  // transaction_amount em reais (decimal). Nosso banco usa centavos.
  const amount = (order.total || 0) / 100;
  const body = {
    transaction_amount: amount,
    description: `Pedido ${order.publicId}`,
    payment_method_id: 'pix',
    payer: {
      email: payer.email || 'test_user_123456@test.com',
      first_name: payer.first_name || 'Cliente',
      last_name: payer.last_name || '',
      identification: payer.identification || { type: 'CPF', number: '12345678909' }
    },
    external_reference: externalReferenceFor(order)
  };
  const resp = await mercadopago.payment.create(body);
  return resp.response; // contem id, point_of_interaction.qr_code e qr_code_base64
}

async function createCardPayment({ order, token, issuer_id, payment_method_id, installments, payer }) {
  const amount = (order.total || 0) / 100;
  const body = {
    transaction_amount: amount,
    token,
    description: `Pedido ${order.publicId}`,
    installments: installments || 1,
    payment_method_id,
    issuer_id,
    payer: {
      email: payer?.email || 'test_user_123456@test.com',
      first_name: payer?.first_name || order.customerName || 'Cliente',
      last_name: payer?.last_name || '',
      identification: payer?.identification || { type: 'CPF', number: '12345678909' }
    },
    external_reference: externalReferenceFor(order),
    statement_descriptor: 'CARDAPIOWEB'
  };
  const resp = await mercadopago.payment.create(body);
  return resp.response;
}

async function getPayment(id) {
  const resp = await mercadopago.payment.findById(id);
  return resp.response;
}

// Validação simples do webhook: se houver segredo, valida HMAC v1; caso contrário, apenas aceita.
function validateWebhookSignature(req) {
  const secret = config.mp.webhookSecret;
  if (!secret) return true; // dev sem segredo
  try {
    const xsign = req.headers['x-signature'];
    if (!xsign) return false;
    // Novo formato: "ts=..., v1=..." (doc MP)
    const parts = Object.fromEntries(xsign.split(',').map(kv => kv.trim().split('=')));
    const crypto = require('crypto');
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const data = `id:${req.headers['x-request-id']};request-id:${req.headers['x-request-id']};ts:${parts.ts};url:${url}`;
    const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return hmac === parts.v1;
  } catch (e) {
    return false;
  }
}

module.exports = { createPixPayment, createCardPayment, getPayment, validateWebhookSignature, externalReferenceFor };