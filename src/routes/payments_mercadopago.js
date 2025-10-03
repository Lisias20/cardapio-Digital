const express = require('express');
const db = require('../db/knex');
const sse = require('../utils/sse');

const router = express.Router();

function mpHeaders() {
  return {
    'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };
}

// Criar pagamento PIX
router.post('/payments/mercadopago/pix', async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    const body = {
      transaction_amount: order.total / 100,
      description: `Pedido ${orderId}`,
      payment_method_id: 'pix',
      payer: { email: 'cliente@example.com', first_name: order.customerName || 'Cliente' },
      external_reference: orderId,
      notification_url: `${process.env.BASE_URL}/webhooks/mercadopago`
    };

    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST', headers: mpHeaders(), body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: 'Falha ao criar PIX', detail: data });

    // salva ref
    await db('orders').where({ id: orderId }).update({ paymentRef: String(data.id), updatedAt: db.fn.now() });

    const tx = data.point_of_interaction?.transaction_data || {};
    res.json({
      paymentId: data.id,
      qr_code: tx.qr_code,
      qr_code_base64: tx.qr_code_base64,
      expires_at: tx.expires_at
    });
  } catch (e) { next(e); }
});

// Criar pagamento Cartão (Bricks envia token e dados)
router.post('/payments/mercadopago/card', async (req, res, next) => {
  try {
    const { orderId, token, installments, payment_method_id, issuer_id, payer } = req.body;
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    const body = {
      transaction_amount: order.total / 100,
      token,
      installments: installments || 1,
      payment_method_id,
      issuer_id,
      description: `Pedido ${orderId}`,
      payer: {
        email: payer?.email || 'cliente@example.com',
        identification: payer?.identification || { type: 'CPF', number: '00000000000' }
      },
      external_reference: orderId,
      capture: true,
      notification_url: `${process.env.BASE_URL}/webhooks/mercadopago`
    };

    const r = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST', headers: mpHeaders(), body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) return res.status(400).json({ error: 'Falha ao pagar com cartão', detail: data });

    // Atualiza pedido se aprovado
    const status = data.status; // approved | in_process | rejected
    await db('orders').where({ id: orderId }).update({
      paymentRef: String(data.id),
      paymentStatus: status === 'approved' ? 'paid' : (status === 'rejected' ? 'failed' : 'pending'),
      updatedAt: db.fn.now()
    });

    sse.publish(orderId, { type: 'payment', paymentStatus: status === 'approved' ? 'paid' : (status === 'rejected' ? 'failed' : 'pending') });

    res.json({ id: data.id, status: data.status, status_detail: data.status_detail });
  } catch (e) { next(e); }
});

// Webhook Mercado Pago
router.post('/webhooks/mercadopago', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // Em produção: validar assinatura x-signature com MP_WEBHOOK_SECRET
    // Aqui, para MVP, apenas processamos o evento.
    const payloadText = req.body.toString();
    let body = {};
    try { body = JSON.parse(payloadText); } catch {}

    const type = body.type || body.action || body.topic; // payment, merchant_order
    const data = body.data || {};
    const paymentId = data.id || body?.resource?.split('/').pop();

    if (type === 'payment' && paymentId) {
      // Busca pagamento e atualiza pedido
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: mpHeaders() });
      const pay = await r.json();
      const orderId = pay.external_reference;
      if (orderId) {
        const status = pay.status; // approved, rejected, in_process
        const paymentStatus = status === 'approved' ? 'paid' : (status === 'rejected' ? 'failed' : 'pending');
        await db('orders').where({ id: orderId }).update({ paymentStatus, paymentRef: String(paymentId), updatedAt: db.fn.now() });
        sse.publish(orderId, { type: 'payment', paymentStatus });
      }
    }

    res.status(200).send('ok');
  } catch (e) {
    console.error('Webhook error', e);
    res.status(200).send('ok');
  }
});

module.exports = router;