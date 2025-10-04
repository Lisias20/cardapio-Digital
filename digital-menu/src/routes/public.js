const express = require('express');
const router = express.Router();
const { knex } = require('../db');
const { calcTotals } = require('../utils/totals');
const { validate, orderSchema } = require('../middlewares/validate');
const { publishToOrder, publishToStore } = require('../utils/sseHub');
const { nanoid } = require('nanoid');

// GET /:storeSlug/menu
router.get('/:storeSlug/menu', async (req, res) => {
  const { storeSlug } = req.params;
  const store = await knex('stores').where({ slug: storeSlug }).first();
  if (!store) return res.status(404).json({ error: 'Loja não encontrada' });

  const categories = await knex('categories').where({ storeId: store.id }).orderBy('position');
  const products = await knex('products').where({ storeId: store.id, active: 1 });
  const groups = await knex('option_groups').where({ storeId: store.id });
  const options = await knex('options').where({ storeId: store.id });

  // Agrupar opções por groupId
  const optionsByGroup = options.reduce((acc, op) => {
    if (!acc[op.groupId]) acc[op.groupId] = [];
    acc[op.groupId].push(op);
    return acc;
  }, {});
  const optionGroups = groups.map(g => ({ ...g, options: optionsByGroup[g.id] || [] }));

  res.json({
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug,
      logoUrl: store.logoUrl,
      themePrimary: store.themePrimary,
      deliveryRadiusKm: Number(store.deliveryRadiusKm || 0),
      deliveryFee: store.deliveryFee || 0,
      packagingFee: store.packagingFee || 0,
      openHours: store.openHours
    },
    categories,
    products,
    optionGroups
  });
});

// POST /:storeSlug/checkout/quote
router.post('/:storeSlug/checkout/quote', async (req, res) => {
  const { storeSlug } = req.params;
  const store = await knex('stores').where({ slug: storeSlug }).first();
  if (!store) return res.status(404).json({ error: 'Loja não encontrada' });

  const { type, items, couponCode } = req.body;
  let deliveryFee = 0;
  let packagingFee = store.packagingFee || 0;
  if (type === 'delivery') deliveryFee = store.deliveryFee || 0;

  let coupon = null;
  if (couponCode) {
    const c = await knex('coupons').where({ storeId: store.id, code: couponCode, active: 1 }).first();
    if (c) coupon = { type: c.type, value: c.value };
  }

  const totals = calcTotals({ items, deliveryFee, packagingFee, coupon });
  res.json(totals);
});

// POST /:storeSlug/orders
router.post('/:storeSlug/orders', validate(orderSchema), async (req, res) => {
  const { storeSlug } = req.params;
  const store = await knex('stores').where({ slug: storeSlug }).first();
  if (!store) return res.status(404).json({ error: 'Loja não encontrada' });

  const body = req.body;
  // Recalcular totais com base no backend
  let deliveryFee = 0;
  let packagingFee = store.packagingFee || 0;
  if (body.type === 'delivery') deliveryFee = store.deliveryFee || 0;

  // Opcional: validação de CEP/raio pode ser adicionada aqui (MVP: aceita tudo)
  let coupon = null;
  if (body.couponCode) {
    const c = await knex('coupons').where({ storeId: store.id, code: body.couponCode, active: 1 }).first();
    if (c) coupon = { type: c.type, value: c.value };
  }

  const totals = calcTotals({ items: body.items, deliveryFee, packagingFee, coupon });

  const publicId = nanoid(12);
  const addressJson = body.type === 'delivery' ? JSON.stringify(body.address || {}) : null;
  const [order] = await knex('orders').insert({
    publicId,
    storeId: store.id,
    type: body.type,
    tableId: body.type === 'dine_in' ? (body.tableId || null) : null,
    customerName: body.customerName || null,
    customerPhone: body.customerPhone || null,
    addressJson,
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    packagingFee: totals.packagingFee,
    discount: totals.discount,
    total: totals.total,
    paymentStatus: 'pending',
    status: 'received',
    paymentProvider: null
  }, ['id']);

  // Items
  for (const it of body.items) {
    const [oi] = await knex('order_items').insert({
      orderId: order.id,
      productId: it.productId,
      nameSnapshot: it.nameSnapshot,
      unitPrice: it.unitPrice,
      qty: it.qty
    }, ['id']);
    for (const op of (it.options || [])) {
      await knex('order_item_options').insert({
        orderItemId: oi.id,
        optionId: op.optionId || null,
        nameSnapshot: op.nameSnapshot,
        price: op.price
      });
    }
  }

  publishToStore(store.id, { type: 'order_new', publicId, status: 'received' });
  res.json({ orderPublicId: publicId, orderId: order.id });
});

// GET /orders/:publicId
router.get('/orders/:publicId', async (req, res) => {
  const { publicId } = req.params;
  const order = await knex('orders').where({ publicId }).first();
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

  const items = await knex('order_items').where({ orderId: order.id });
  const opts = await knex('order_item_options').whereIn('orderItemId', items.map(i => i.id));
  const itemsWithOptions = items.map(i => ({
    ...i,
    options: opts.filter(o => o.orderItemId === i.id)
  }));

  // Tema da loja para front
  const store = await knex('stores').where({ id: order.storeId }).first();

  res.json({
    order: {
      publicId: order.publicId,
      storeId: order.storeId,
      type: order.type,
      tableId: order.tableId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address: order.addressJson ? JSON.parse(order.addressJson) : null,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      packagingFee: order.packagingFee,
      discount: order.discount,
      total: order.total,
      paymentStatus: order.paymentStatus,
      status: order.status,
      paymentProvider: order.paymentProvider,
      paymentRef: order.paymentRef,
      createdAt: order.createdAt
    },
    items: itemsWithOptions,
    store: {
      name: store.name,
      slug: store.slug,
      themePrimary: store.themePrimary,
      logoUrl: store.logoUrl
    }
  });
});

// SSE público: GET /orders/:publicId/stream
const { subscribeOrder } = require('../utils/sseHub');
router.get('/orders/:publicId/stream', (req, res) => {
  subscribeOrder(req.params.publicId, res);
});

module.exports = router;