const express = require('express');
const { knex, now } = require('../utils/db');
const { getPaymentById, verifyWebhookSignature } = require('../payments/mercadopago');
const { rateLimit } = require('../middlewares/rateLimit');
const { broadcast } = require('../utils/sse');
const { broadcastStore } = require('../utils/bus');

const router = express.Router();

// Aceita GET (alguns testes do MP chamam GET) e POST para eventos reais
router.get('/webhooks/mercadopago', (req, res) => res.status(200).send('ok'));

// Rate limit leve para evitar storms
router.use('/webhooks/mercadopago', rateLimit({ windowMs: 15000, max: 50, keyGenerator: req => `mp:${req.ip}` }));

router.post('/webhooks/mercadopago', express.json(), async (req, res) => {
  try {
    // Verificação de assinatura (melhor esforço)
    const sig = verifyWebhookSignature(req);
    if (!sig.valid) {
      console.warn('Webhook MP assinatura inválida:', sig.reason);
      // Em sandbox, não bloqueamos. Em produção, você pode retornar 401 aqui.
    }

    // Extrai id do pagamento (v1: query.id; v2: body.data.id)
    const mpPaymentId = req.query.id || req.body?.data?.id || req.body?.id;
    if (!mpPaymentId) {
      console.warn('Webhook MP sem payment id:', req.body);
      return res.status(200).send('ok');
    }

    // Busca o pagamento no MP para garantir status verdadeiro
    const payment = await getPaymentById(mpPaymentId);
    const status = payment.status; // approved | rejected | in_process | pending | cancelled | refunded
    const extRef = payment.external_reference;
    const metadata = payment.metadata || {};

    // Resolve pedido
    let order = null;
    if (metadata.orderId) {
      order = await knex('orders').where({ id: metadata.orderId }).first();
    }
    if (!order && extRef) {
      order = await knex('orders').where({ id: String(extRef) }).first();
    }
    if (!order) {
      console.warn('Webhook MP: pedido não encontrado para payment', mpPaymentId);
      return res.status(200).send('ok');
    }

    // Mapeia status
    let paymentStatus = 'pending';
    if (status === 'approved') paymentStatus = 'paid';
    else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)) paymentStatus = 'failed';
    else paymentStatus = 'pending';

    await knex('orders').where({ id: order.id }).update({
      paymentStatus,
      paymentProvider: 'mercadopago',
      paymentRef: String(mpPaymentId),
      updatedAt: now()
    });

    const updated = await knex('orders').where({ id: order.id }).first();

    // Notifica cliente (pedido) e KDS (loja)
    broadcast(order.id, {
      id: updated.id,
      status: updated.status,
      paymentStatus: updated.paymentStatus,
      updatedAt: updated.updatedAt
    });
    broadcastStore(updated.storeId, {
      kind: 'payment_update',
      orderId: updated.id,
      paymentStatus: updated.paymentStatus,
      updatedAt: updated.updatedAt
    });

    res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook MP erro', err);
    // MP reenvia; responda 200 para evitar storms (banco deve ser idempotente)
    res.status(200).send('ok');
  }
});

module.exports = router;