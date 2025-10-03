const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/knex');
const { loadStoreBySlug } = require('../middleware/tenant');
const { orderSchema } = require('../utils/validation');
const sse = require('../utils/sse');

const router = express.Router();

// Menu público
router.get('/:storeSlug/menu', loadStoreBySlug, async (req, res, next) => {
  try {
    const store = req.store;
    const categories = await db('categories').where({ storeId: store.id }).orderBy('position', 'asc');
    const products = await db('products').where({ storeId: store.id, active: 1 });
    const groups = await db('option_groups').where({ storeId: store.id });
    const options = await db('options').where({ storeId: store.id });

    res.json({ store, categories, products, optionGroups: groups, options });
  } catch (e) {
    next(e);
  }
});

// Quote simples (soma no backend)
router.post('/:storeSlug/checkout/quote', loadStoreBySlug, async (req, res, next) => {
  try {
    const store = req.store;
    const { type, items } = req.body;
    let subtotal = 0;

    // Busca preços seguros do backend
    for (const it of items || []) {
      const prod = await db('products').where({ id: it.productId, storeId: store.id }).first();
      if (!prod || !prod.active) return res.status(400).json({ error: 'Produto inválido' });
      subtotal += prod.price * (it.qty || 1);
      if (it.options && it.options.length) {
        for (const op of it.options) {
          const opt = await db('options').where({ id: op.optionId, storeId: store.id }).first();
          if (opt) subtotal += opt.price;
        }
      }
    }

    const packagingFee = store.packagingFee || 0;
    const deliveryFee = type === 'delivery' ? (store.deliveryFee || 0) : 0;
    const discount = 0; // cupons podem vir depois
    const total = subtotal + packagingFee + deliveryFee - discount;

    res.json({ subtotal, packagingFee, deliveryFee, discount, total });
  } catch (e) {
    next(e);
  }
});

// Cria pedido
router.post('/:storeSlug/orders', loadStoreBySlug, async (req, res, next) => {
  try {
    const store = req.store;
    const { error, value } = orderSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details.map(d => d.message).join(', ') });

    const { type, tableId, customerName, customerPhone, address, items, totals } = value;

    // Validar mesa quando dine_in
    if (type === 'dine_in') {
      const table = await db('tables').where({ id: tableId, storeId: store.id, active: 1 }).first();
      if (!table) return res.status(400).json({ error: 'Mesa inválida' });
    }

    // Calcular novamente para garantir integridade
    const quoteRes = await fetch(`${process.env.BASE_URL || 'http://localhost:3000'}/${store.slug}/checkout/quote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, items })
    });
    const serverTotals = await quoteRes.json();
    if (serverTotals.total !== totals.total) return res.status(400).json({ error: 'Total inválido' });

    const orderId = uuid();
    const publicToken = uuid();

    await db('orders').insert({
      id: orderId,
      storeId: store.id,
      type,
      tableId: type === 'dine_in' ? tableId : null,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      addressJson: type === 'delivery' ? JSON.stringify(address || {}) : null,
      subtotal: serverTotals.subtotal,
      deliveryFee: serverTotals.deliveryFee,
      packagingFee: serverTotals.packagingFee,
      discount: serverTotals.discount,
      total: serverTotals.total,
      paymentStatus: 'pending',
      status: 'received',
      paymentProvider: 'mercadopago',
      publicToken
    });

    for (const it of items) {
      const id = uuid();
      const prod = await db('products').where({ id: it.productId }).first();
      await db('order_items').insert({
        id,
        orderId,
        productId: prod.id,
        nameSnapshot: prod.name,
        unitPrice: prod.price,
        qty: it.qty || 1
      });
      for (const op of (it.options || [])) {
        const opt = await db('options').where({ id: op.optionId }).first();
        if (opt) {
          await db('order_item_options').insert({
            id: uuid(),
            orderItemId: id,
            optionId: opt.id,
            nameSnapshot: opt.name,
            price: opt.price
          });
        }
      }
    }

    res.status(201).json({ orderId, publicToken });
  } catch (e) {
    next(e);
  }
});

// Dados do pedido (público com token)
router.get('/orders/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { t } = req.query;
    const order = await db('orders').where({ id }).first();
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (order.publicToken !== t) return res.status(403).json({ error: 'Token inválido' });

    const items = await db('order_items').where({ orderId: id });
    const itemIds = items.map(i => i.id);
    const opts = await db('order_item_options').whereIn('orderItemId', itemIds);

    res.json({ order, items, options: opts });
  } catch (e) { next(e); }
});

// SSE para status do pedido
router.get('/orders/:id/stream', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { t } = req.query;
    const order = await db('orders').where({ id }).first();
    if (!order) return res.status(404).end();
    if (order.publicToken !== t) return res.status(403).end();

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.flushHeaders();

    // Envia status inicial
    res.write(`data: ${JSON.stringify({ type: 'init', status: order.status, paymentStatus: order.paymentStatus })}\n\n`);

    // Assina
    sse.subscribe(id, res);
  } catch (e) { next(e); }
});

module.exports = router;