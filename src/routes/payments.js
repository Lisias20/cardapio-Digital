const express = require('express');
const Joi = require('joi');
const { knex, now } = require('../utils/db');
const { MP_PUBLIC_KEY, createPixPayment, processCardPayment } = require('../payments/mercadopago');
const { broadcast } = require('../utils/sse');
const { broadcastStore } = require('../utils/bus');

const router = express.Router();

async function getOrderAndStore(orderId, storeSlug) {
  const order = await knex('orders').where({ id: orderId }).first();
  if (!order) return { error: 'Pedido não encontrado' };
  const store = await knex('stores').where({ id: order.storeId }).first();
  if (!store) return { error: 'Loja não encontrada' };
  if (storeSlug && store.slug !== storeSlug) return { error: 'Pedido não pertence à loja' };
  return { order, store };
}

// POST /payments/mercadopago/intent
router.post('/payments/mercadopago/intent', async (req, res) => {
  const schema = Joi.object({
    op: Joi.string().valid('pix', 'card_init', 'card_pay').required(),
    orderId: Joi.string().required(),
    storeSlug: Joi.string().required(),
    cardFormData: Joi.object().optional()
  });

  try {
    const { op, orderId, storeSlug, cardFormData } = await schema.validateAsync(req.body, { stripUnknown: true });
    const ctx = await getOrderAndStore(orderId, storeSlug);
    if (ctx.error) return res.status(404).json({ message: ctx.error });
    const { order, store } = ctx;

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Pedido já pago' });
    }

    if (op === 'card_init') {
      return res.json({ publicKey: MP_PUBLIC_KEY, amount: order.total });
    }

    if (op === 'pix') {
      const out = await createPixPayment({ order, store });
      // Atualiza provider/ref
      await knex('orders').where({ id: orderId }).update({
        paymentProvider: 'mercadopago',
        paymentRef: String(out.mpPaymentId),
        updatedAt: now()
      });
      return res.json(out);
    }

    if (op === 'card_pay') {
      const out = await processCardPayment({ order, store, cardFormData });
      const paymentStatus =
        out.status === 'approved' ? 'paid' :
        out.status === 'rejected' ? 'failed' : 'pending';

      await knex('orders').where({ id: orderId }).update({
        paymentProvider: 'mercadopago',
        paymentRef: String(out.mpPaymentId),
        paymentStatus,
        updatedAt: now()
      });

      // Broadcast otimista (webhook confirmará)
      const updated = await knex('orders').where({ id: orderId }).first();
      broadcast(orderId, {
        id: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        updatedAt: updated.updatedAt
      });
      broadcastStore(store.id, {
        kind: 'payment_update',
        orderId,
        paymentStatus: updated.paymentStatus,
        updatedAt: updated.updatedAt
      });

      return res.json({ status: out.status });
    }

    res.status(400).json({ message: 'Operação inválida' });
  } catch (err) {
    console.error('POST /payments/mercadopago/intent error', err);
    res.status(400).json({ message: err.message || 'Falha no pagamento' });
  }
});

module.exports = router;