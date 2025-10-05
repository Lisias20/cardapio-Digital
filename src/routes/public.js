const express = require('express');
const Joi = require('joi');
const { nanoid } = require('nanoid');
const { knex, withTx, now } = require('../utils/db');
const { sseHeaders, subscribe, unsubscribe, keepAlive, broadcast } = require('../utils/sse');
const { broadcastStore } = require('../utils/bus');

const router = express.Router();

// Utils
async function getStoreBySlug(slug) {
  const store = await knex('stores').where({ slug }).first();
  if (!store) return null;
  if (typeof store.openHours === 'string') {
    try { store.openHours = JSON.parse(store.openHours); } catch { store.openHours = null; }
  }
  return store;
}

function cents(n) {
  return Math.max(0, Math.round(Number(n || 0)));
}

// Reprecifica carrinho no backend
async function priceCart(storeId, items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { itemsDetailed: [], subtotal: 0 };
  }
  const productIds = [...new Set(items.map(i => i.productId))];
  const optionIds = [...new Set(items.flatMap(i => i.options || []))];

  const products = productIds.length
    ? await knex('products').whereIn('id', productIds).andWhere({ storeId, active: 1 })
    : [];

  const options = optionIds.length
    ? await knex('options').whereIn('id', optionIds).andWhere({ storeId })
    : [];

  const pMap = new Map(products.map(p => [p.id, p]));
  const oMap = new Map(options.map(o => [o.id, o]));

  let subtotal = 0;
  const itemsDetailed = [];

  for (const it of items) {
    const p = pMap.get(it.productId);
    if (!p) continue;
    const qty = Math.max(1, Number(it.qty || 1));
    const chosenOptions = (it.options || []).map(id => oMap.get(id)).filter(Boolean);
    const base = cents(p.price);
    const optsSum = chosenOptions.reduce((acc, o) => acc + cents(o.price), 0);
    const line = (base + optsSum) * qty;
    subtotal += line;

    itemsDetailed.push({
      productId: p.id,
      name: p.name,
      unitPrice: base,
      qty,
      total: line,
      options: chosenOptions.map(o => ({ optionId: o.id, name: o.name, price: cents(o.price) })),
      note: it.note || ''
    });
  }
  return { itemsDetailed, subtotal };
}

async function applyCoupon(storeId, couponCode, amountCents) {
  if (!couponCode) return { discount: 0, coupon: null };
  const coupon = await knex('coupons')
    .where({ storeId, code: couponCode, active: 1 })
    .andWhere(function () {
      this.whereNull('expiresAt').orWhere('expiresAt', '>', new Date().toISOString());
    })
    .first();

  if (!coupon) return { discount: 0, coupon: null };

  let discount = 0;
  if (coupon.type === 'percentage') {
    const pct = Math.max(0, Math.min(100, Number(coupon.value || 0)));
    discount = Math.round((amountCents * pct) / 100);
  } else {
    discount = cents(coupon.value);
  }
  discount = Math.min(discount, amountCents);
  return { discount, coupon };
}

// GET /:storeSlug/menu -> dados do cardápio
router.get('/:storeSlug/menu', async (req, res) => {
  try {
    const { storeSlug } = req.params;
    const store = await getStoreBySlug(storeSlug);
    if (!store) return res.status(404).json({ message: 'Loja não encontrada' });

    const [categories, products, optionGroups, options] = await Promise.all([
      knex('categories').where({ storeId: store.id }).orderBy('position', 'asc'),
      knex('products').where({ storeId: store.id, active: 1 }).orderBy('id', 'asc'),
      knex('option_groups').where({ storeId: store.id }).orderBy('id', 'asc'),
      knex('options').where({ storeId: store.id }).orderBy('id', 'asc'),
    ]);

    const cats = categories.map(c => ({
      ...c,
      products: products.filter(p => p.categoryId === c.id)
    }));

    res.json({
      store,
      categories: cats,
      products,
      option_groups: optionGroups,
      options
    });
  } catch (err) {
    console.error('GET /:storeSlug/menu', err);
    res.status(500).json({ message: 'Erro ao carregar cardápio' });
  }
});

// POST /:storeSlug/checkout/quote -> calcula totais
router.post('/:storeSlug/checkout/quote', async (req, res) => {
  const schema = Joi.object({
    type: Joi.string().valid('dine_in', 'pickup', 'delivery').required(),
    tableId: Joi.number().integer().min(1).optional(),
    items: Joi.array().items(Joi.object({
      productId: Joi.number().integer().required(),
      qty: Joi.number().integer().min(1).required(),
      note: Joi.string().max(300).allow('').optional(),
      options: Joi.array().items(Joi.number().integer()).default([])
    })).min(1).required(),
    coupon: Joi.string().max(40).allow('', null).optional(),
    delivery: Joi.object({
      cep: Joi.string().allow('', null),
      address: Joi.string().allow('', null),
      number: Joi.string().allow('', null),
      complement: Joi.string().allow('', null)
    }).optional()
  });

  try {
    const { storeSlug } = req.params;
    const store = await getStoreBySlug(storeSlug);
    if (!store) return res.status(404).json({ message: 'Loja não encontrada' });

    const body = await schema.validateAsync(req.body, { stripUnknown: true });

    if (body.type === 'dine_in' && body.tableId) {
      const table = await knex('tables').where({ id: body.tableId, storeId: store.id, active: 1 }).first();
      if (!table) return res.status(400).json({ message: 'Mesa inválida' });
    }

    const { itemsDetailed, subtotal } = await priceCart(store.id, body.items);
    if (!itemsDetailed.length) return res.status(400).json({ message: 'Carrinho inválido' });

    const packagingFee = cents(store.packagingFee || 0);
    const deliveryFee = body.type === 'delivery' ? cents(store.deliveryFee || 0) : 0;
    const { discount } = await applyCoupon(store.id, body.coupon, subtotal + packagingFee + deliveryFee);
    const total = Math.max(0, subtotal + packagingFee + deliveryFee - discount);

    res.json({ items: itemsDetailed, subtotal, packagingFee, deliveryFee, discount, total });
  } catch (err) {
    console.error('POST /:storeSlug/checkout/quote', err);
    res.status(400).json({ message: err.message || 'Falha ao calcular totais' });
  }
});

// POST /:storeSlug/orders -> cria pedido
router.post('/:storeSlug/orders', async (req, res) => {
  const schema = Joi.object({
    type: Joi.string().valid('dine_in', 'pickup', 'delivery').required(),
    tableId: Joi.number().integer().allow(null),
    items: Joi.array().items(Joi.object({
      productId: Joi.number().integer().required(),
      qty: Joi.number().integer().min(1).required(),
      note: Joi.string().max(300).allow('').optional(),
      options: Joi.array().items(Joi.number().integer()).default([])
    })).min(1).required(),
    customerName: Joi.string().allow('').default(''),
    customerPhone: Joi.string().allow('').default(''),
    addressJson: Joi.object().allow(null),
    coupon: Joi.string().allow(null, ''),
    totalsHint: Joi.object().optional()
  });

  try {
    const { storeSlug } = req.params;
    const store = await getStoreBySlug(storeSlug);
    if (!store) return res.status(404).json({ message: 'Loja não encontrada' });

    const body = await schema.validateAsync(req.body, { stripUnknown: true });

    if (body.type === 'dine_in') {
      if (!body.tableId) return res.status(400).json({ message: 'Mesa não informada' });
      const t = await knex('tables').where({ id: body.tableId, storeId: store.id, active: 1 }).first();
      if (!t) return res.status(400).json({ message: 'Mesa inválida' });
    }

    if (body.type === 'delivery') {
      if (!body.customerName?.trim() || !body.customerPhone?.trim()) {
        return res.status(400).json({ message: 'Dados do cliente faltando' });
      }
    }

    const { itemsDetailed, subtotal } = await priceCart(store.id, body.items);
    if (!itemsDetailed.length) return res.status(400).json({ message: 'Carrinho inválido' });

    const packagingFee = cents(store.packagingFee || 0);
    const deliveryFee = body.type === 'delivery' ? cents(store.deliveryFee || 0) : 0;
    const { discount } = await applyCoupon(store.id, body.coupon, subtotal + packagingFee + deliveryFee);
    const total = Math.max(0, subtotal + packagingFee + deliveryFee - discount);

    const id = 'ord_' + nanoid(10);
    const createdAt = now();

    await withTx(async (trx) => {
      await trx('orders').insert({
        id,
        storeId: store.id,
        type: body.type,
        tableId: body.type === 'dine_in' ? body.tableId : null,
        customerName: body.type === 'delivery' ? body.customerName : '',
        customerPhone: body.type === 'delivery' ? body.customerPhone : '',
        addressJson: body.type === 'delivery' ? JSON.stringify(body.addressJson || {}) : null,
        subtotal,
        deliveryFee,
        packagingFee,
        discount,
        total,
        paymentStatus: 'pending',
        status: 'received',
        paymentProvider: null,
        paymentRef: null,
        createdAt,
        updatedAt: createdAt
      });

      for (const it of itemsDetailed) {
        const [orderItemId] = await trx('order_items').insert({
          orderId: id,
          productId: it.productId,
          nameSnapshot: it.name,
          unitPrice: it.unitPrice,
          qty: it.qty
        });
        if (it.options?.length) {
          await trx('order_item_options').insert(
            it.options.map(o => ({
              orderItemId,
              optionId: o.optionId,
              nameSnapshot: o.name,
              price: o.price
            }))
          );
        }
      }
    });

    // Notifica KDS/Admin
    broadcastStore(store.id, {
      kind: 'order_created',
      orderId: id,
      status: 'received',
      paymentStatus: 'pending',
      total,
      type: body.type,
      createdAt
    });

    res.json({ orderId: id });
  } catch (err) {
    console.error('POST /:storeSlug/orders', err);
    res.status(400).json({ message: err.message || 'Falha ao criar pedido' });
  }
});

// GET /orders/:id -> dados do pedido (público)
router.get('/orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const order = await knex('orders').where({ id }).first();
    if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

    const store = await knex('stores').where({ id: order.storeId }).first();
    const items = await knex('order_items').where({ orderId: id });
    const itemIds = items.map(i => i.id);
    const opts = itemIds.length ? await knex('order_item_options').whereIn('orderItemId', itemIds) : [];

    const itemsDetailed = items.map(it => ({
      id: it.id,
      productId: it.productId,
      nameSnapshot: it.nameSnapshot,
      unitPrice: it.unitPrice,
      qty: it.qty,
      options: opts.filter(o => o.orderItemId === it.id)
    }));

    res.json({
      id: order.id,
      store: store ? { id: store.id, name: store.name, slug: store.slug, logoUrl: store.logoUrl, themePrimary: store.themePrimary } : null,
      type: order.type,
      tableId: order.tableId,
      customerName: order.type === 'delivery' ? order.customerName : '',
      customerPhone: order.type === 'delivery' ? order.customerPhone : '',
      addressJson: order.type === 'delivery' ? (order.addressJson ? JSON.parse(order.addressJson) : null) : null,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      packagingFee: order.packagingFee,
      discount: order.discount,
      total: order.total,
      paymentStatus: order.paymentStatus,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: itemsDetailed
    });
  } catch (err) {
    console.error('GET /orders/:id', err);
    res.status(500).json({ message: 'Erro ao carregar pedido' });
  }
});

// GET /orders/:id/stream -> SSE (status/pagamento em tempo real)
router.get('/orders/:id/stream', async (req, res) => {
  try {
    const id = req.params.id;
    const order = await knex('orders').where({ id }).first();
    if (!order) return res.status(404).end();

    sseHeaders(res);
    res.flushHeaders?.();

    // Snapshot inicial
    res.write(`data: ${JSON.stringify({
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt
    })}\n\n`);

    subscribe(id, res);
    const ping = keepAlive(res);

    req.on('close', () => {
      clearInterval(ping);
      unsubscribe(id, res);
    });
  } catch (err) {
    console.error('SSE /orders/:id/stream', err);
    res.status(500).end();
  }
});

module.exports = router;