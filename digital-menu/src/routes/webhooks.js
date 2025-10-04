const express = require('express');
const router = express.Router();
const { knex } = require('../db');
const { webhookLimiter } = require('../middlewares/rateLimiters');
const { validateWebhookSignature, getPayment } = require('../payments/mercadopago');
const { publishToOrder, publishToStore } = require('../utils/sseHub');

// POST /webhooks/mercadopago
router.post('/mercadopago', webhookLimiter, async (req, res) => {
  // Validação de assinatura (opcional em dev)
  if (!validateWebhookSignature(req)) {
    console.warn('Assinatura do webhook MP inválida (ignorando em dev se SECRET não definido)');
    // Continui mesmo assim em dev
  }

  try {
    const topic = req.query.type || req.body.type || 'payment';
    // MP envia { action, data: { id } }
    const id = req.query['data.id'] || req.body?.data?.id || req.body?.data_id || req.body?.id;
    if (!id) {
      console.log('Webhook MP sem id', req.body);
      return res.status(200).send('ok');
    }

    const payment = await getPayment(id);
    const ext = payment.external_reference || '';
    // external_reference = order:<publicId>;store:<storeId>
    const publicId = (ext.match(/order:([^;]+)/) || [])[1];
    const storeId = Number((ext.match(/store:(\d+)/) || [])[1]);
    if (!publicId) {
      console.warn('Webhook MP sem external_reference público', payment.id, ext);
      return res.status(200).send('ok');
    }

    const order = await knex('orders').where({ publicId }).first();
    if (!order) return res.status(200).send('ok');

    const statusMap = {
      approved: 'paid',
      authorized: 'paid',
      in_process: 'pending',
      rejected: 'failed',
      cancelled: 'failed',
      refunded: 'refunded'
    };
    const newPayStatus = statusMap[payment.status] || order.paymentStatus;

    let newStatus = order.status;
    if (order.paymentStatus !== 'paid' && newPayStatus === 'paid') {
      newStatus = 'accepted';
    } else if (newPayStatus === 'failed') {
      // mantém status de pedido, apenas marca falha de pagamento
    }

    // Idempotência: só atualiza se mudou
    if (newPayStatus !== order.paymentStatus || newStatus !== order.status) {
      await knex('orders').update({
        paymentProvider: 'mercadopago',
        paymentRef: String(payment.id),
        paymentStatus: newPayStatus,
        status: newStatus
      }).where({ id: order.id });

      publishToOrder(order.publicId, { paymentStatus: newPayStatus, status: newStatus });
      publishToStore(order.storeId, { type: 'order_update', publicId: order.publicId, paymentStatus: newPayStatus, status: newStatus });
    }

    return res.status(200).send('ok');
  } catch (e) {
    console.error('Erro webhook MP', e?.response?.data || e);
    return res.status(200).send('ok'); // nunca falhe webhook
  }
});

module.exports = router;