const express = require('express');
const router = express.Router();
const { knex } = require('../db');
const config = require('../config');
const { createPixPayment, createCardPayment } = require('../payments/mercadopago');
const { publishToOrder, publishToStore } = require('../utils/sseHub');

// POST /payments/mercadopago/intent
router.post('/mercadopago/intent', async (req, res) => {
  const { orderPublicId, method } = req.body || {};
  if (!orderPublicId || !method) return res.status(400).json({ error: 'Parâmetros ausentes' });

  const order = await knex('orders').where({ publicId: orderPublicId }).first();
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  const store = await knex('stores').where({ id: order.storeId }).first();

  if (method === 'card_init') {
    // Card Brick precisa basicamente do amount; a cobrança ocorre no /card
    return res.json({ publicKey: config.mp.publicKey, amount: order.total / 100, orderPublicId });
  }

  if (method === 'pix') {
    try {
      const payment = await createPixPayment({ order, payer: { email: 'test_user@test.com' } });
      await knex('orders').update({
        paymentProvider: 'mercadopago',
        paymentRef: String(payment.id),
        paymentStatus: 'pending'
      }).where({ id: order.id });

      const poi = payment.point_of_interaction || {};
      const qr = poi.transaction_data || {};
      return res.json({
        paymentId: payment.id,
        qr_code: qr.qr_code,
        qr_code_base64: qr.qr_code_base64,
        expires_at: qr.expires_at,
        amount: order.total / 100
      });
    } catch (e) {
      console.error('Erro PIX MP:', e?.response?.data || e);
      return res.status(400).json({ error: 'Falha ao criar PIX' });
    }
  }

  return res.status(400).json({ error: 'Método inválido' });
});

// POST /payments/mercadopago/card
router.post('/mercadopago/card', async (req, res) => {
  const { orderPublicId, token, issuer_id, payment_method_id, installments, payer } = req.body || {};

  if (!orderPublicId || !token || !payment_method_id) return res.status(400).json({ error: 'Parâmetros ausentes' });

  const order = await knex('orders').where({ publicId: orderPublicId }).first();
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

  try {
    const payment = await createCardPayment({ order, token, issuer_id, payment_method_id, installments, payer });
    const statusMap = {
      approved: 'paid',
      authorized: 'paid',
      in_process: 'pending',
      rejected: 'failed',
      cancelled: 'failed',
      refunded: 'refunded'
    };
    const newPayStatus = statusMap[payment.status] || 'pending';
    await knex('orders').update({
      paymentProvider: 'mercadopago',
      paymentRef: String(payment.id),
      paymentStatus: newPayStatus,
      status: newPayStatus === 'paid' ? 'accepted' : 'received'
    }).where({ id: order.id });

    const updated = await knex('orders').where({ id: order.id }).first();
    publishToOrder(order.publicId, { paymentStatus: updated.paymentStatus, status: updated.status });
    publishToStore(order.storeId, { type: 'order_update', publicId: order.publicId, paymentStatus: updated.paymentStatus, status: updated.status });

    return res.json({ paymentId: payment.id, status: payment.status, mp: payment });
  } catch (e) {
    console.error('Erro cartão MP:', e?.response?.data || e);
    return res.status(400).json({ error: 'Falha no pagamento' });
  }
});

module.exports = router;