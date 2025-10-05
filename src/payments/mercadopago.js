// Provider Mercado Pago (PIX e Cartão)
// Requer: MP_ACCESS_TOKEN, MP_PUBLIC_KEY e (opcional) MP_WEBHOOK_SECRET no .env
const crypto = require('crypto');
const { MP_ACCESS_TOKEN, MP_PUBLIC_KEY, MP_WEBHOOK_SECRET, BASE_URL } = require('../utils/config');

const API_BASE = 'https://api.mercadopago.com';

function assertConfigured() {
  if (!MP_ACCESS_TOKEN) throw new Error('Mercado Pago: MP_ACCESS_TOKEN ausente no .env');
  if (!MP_PUBLIC_KEY) throw new Error('Mercado Pago: MP_PUBLIC_KEY ausente no .env');
}

async function mpFetch(path, { method = 'GET', headers = {}, body, idempotencyKey } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || json?.error || `Erro ${res.status}`;
    throw new Error(`Mercado Pago error: ${msg}`);
  }
  return json;
}

function centsToBRLNumber(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

async function createPixPayment({ order, store }) {
  assertConfigured();
  const amount = centsToBRLNumber(order.total);
  const idempotencyKey = `pix_${order.id}`;

  const payload = {
    transaction_amount: amount,
    description: `Pedido ${order.id} - ${store.name}`,
    payment_method_id: 'pix',
    payer: {
      email: 'comprador_teste@example.com' // sandbox; em prod, use email/CPF do cliente
    },
    external_reference: order.id,
    statement_descriptor: (store.name || 'Pedido').slice(0, 22),
    notification_url: `${BASE_URL}/webhooks/mercadopago`,
    metadata: {
      orderId: order.id,
      storeId: store.id,
      storeSlug: store.slug
    }
  };

  const data = await mpFetch('/v1/payments', {
    method: 'POST',
    body: payload,
    idempotencyKey
  });

  const trx = data?.point_of_interaction?.transaction_data || {};
  return {
    mpPaymentId: data.id,
    status: data.status, // pending
    qr_code: trx.qr_code,
    qr_code_base64: trx.qr_code_base64,
    copyPaste: trx.qr_code,
    expiresAt: trx?.expiration_time ? new Date(trx.expiration_time * 1000).toISOString() : null
  };
}

async function processCardPayment({ order, store, cardFormData }) {
  assertConfigured();
  const amount = centsToBRLNumber(order.total);
  const idempotencyKey = `card_${order.id}`;

  const payload = {
    transaction_amount: amount,
    token: cardFormData.token,
    installments: Number(cardFormData.installments || 1),
    payment_method_id: cardFormData.paymentMethodId,
    issuer_id: cardFormData.issuerId,
    description: `Pedido ${order.id} - ${store.name}`,
    external_reference: order.id,
    notification_url: `${BASE_URL}/webhooks/mercadopago`,
    statement_descriptor: (store.name || 'Pedido').slice(0, 22),
    payer: {
      email: cardFormData.payer?.email || 'comprador_teste@example.com',
      identification: cardFormData.payer?.identification
        ? {
            type: cardFormData.payer.identification.type,
            number: cardFormData.payer.identification.number
          }
        : undefined
    },
    metadata: {
      orderId: order.id,
      storeId: store.id,
      storeSlug: store.slug
    },
    capture: true
  };

  const data = await mpFetch('/v1/payments', {
    method: 'POST',
    body: payload,
    idempotencyKey
  });

  return {
    mpPaymentId: data.id,
    status: data.status // approved | in_process | rejected
  };
}

async function getPaymentById(id) {
  assertConfigured();
  return mpFetch(`/v1/payments/${id}`, { method: 'GET' });
}

// Verificação "melhor esforço" do x-signature. Se MP_WEBHOOK_SECRET não estiver setado, retorna válido.
function verifyWebhookSignature(req) {
  try {
    if (!MP_WEBHOOK_SECRET) return { valid: true, reason: 'no-secret' };
    const sig = req.headers['x-signature'];
    const reqId = req.headers['x-request-id'];
    if (!sig || !reqId) return { valid: false, reason: 'missing-headers' };

    const [tsPart, v1Part] = String(sig).split(',').map(s => s.trim());
    const ts = tsPart?.split('=')[1];
    const v1 = v1Part?.split('=')[1];
    if (!ts || !v1) return { valid: false, reason: 'invalid-format' };

    // Docs MP: base string depende dos query params; aqui usamos padrão mais comum (data.id via query.id).
    const base = `id=${req.query.id}&request-id=${reqId}&ts=${ts}`;
    const hmac = crypto.createHmac('sha256', MP_WEBHOOK_SECRET);
    hmac.update(base);
    const expected = hmac.digest('hex');

    const ok = (() => {
      try {
        return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
      } catch { return false; }
    })();

    return { valid: ok, reason: 'checked' };
  } catch (err) {
    return { valid: false, reason: 'error' };
  }
}

module.exports = {
  MP_PUBLIC_KEY,
  createPixPayment,
  processCardPayment,
  getPaymentById,
  verifyWebhookSignature
};