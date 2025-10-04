const express = require('express');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { knex } = require('../db');
const { requireAuth, attachStoreId } = require('../middlewares/auth');
const { loginLimiter } = require('../middlewares/rateLimiters');
const { generateTableQR } = require('../utils/qrcodes');
const config = require('../config');
const { subscribeStore } = require('../utils/sseHub');

const router = express.Router();

// Uploads locais (em produção: S3; ver README)
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// Auth
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha' });
  const user = await knex('users').where({ email }).first();
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
  req.session.user = { id: user.id, email: user.email, storeId: user.storeId, role: user.role };
  res.json({ ok: true, user: req.session.user });
});
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// Store config
router.get('/store', requireAuth, attachStoreId, async (req, res) => {
  const store = await knex('stores').where({ id: req.storeId }).first();
  res.json(store);
});
router.put('/store', requireAuth, attachStoreId, async (req, res) => {
  const allowed = ['name', 'logoUrl', 'themePrimary', 'deliveryRadiusKm', 'deliveryFee', 'packagingFee', 'openHours'];
  const data = {};
  for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
  await knex('stores').update(data).where({ id: req.storeId });
  const store = await knex('stores').where({ id: req.storeId }).first();
  res.json(store);
});

// Categorias
router.get('/categories', requireAuth, attachStoreId, async (req, res) => {
  const rows = await knex('categories').where({ storeId: req.storeId }).orderBy('position');
  res.json(rows);
});
router.post('/categories', requireAuth, attachStoreId, async (req, res) => {
  const { name, position = 0 } = req.body;
  const [row] = await knex('categories').insert({ storeId: req.storeId, name, position }, ['id']);
  res.json({ id: row.id, name, position });
});
router.put('/categories/:id', requireAuth, attachStoreId, async (req, res) => {
  const { name, position } = req.body;
  await knex('categories').update({ name, position }).where({ id: req.params.id, storeId: req.storeId });
  res.json({ ok: true });
});
router.delete('/categories/:id', requireAuth, attachStoreId, async (req, res) => {
  await knex('categories').where({ id: req.params.id, storeId: req.storeId }).del();
  res.json({ ok: true });
});

// Produtos
router.get('/products', requireAuth, attachStoreId, async (req, res) => {
  const rows = await knex('products').where({ storeId: req.storeId });
  res.json(rows);
});
router.post('/products', requireAuth, attachStoreId, upload.single('image'), async (req, res) => {
  const { name, description, price, categoryId, active = true } = req.body;
  let imageUrl = req.body.imageUrl || null;
  if (req.file) imageUrl = `/uploads/${req.file.filename}`;
  const [row] = await knex('products').insert({
    storeId: req.storeId, categoryId, name, description, price: Number(price), imageUrl, active: Boolean(Number(active))
  }, ['id']);
  res.json({ id: row.id });
});
router.put('/products/:id', requireAuth, attachStoreId, upload.single('image'), async (req, res) => {
  const { name, description, price, categoryId, active } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (price !== undefined) data.price = Number(price);
  if (categoryId !== undefined) data.categoryId = Number(categoryId);
  if (active !== undefined) data.active = Boolean(Number(active));
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;
  await knex('products').update(data).where({ id: req.params.id, storeId: req.storeId });
  res.json({ ok: true });
});
router.delete('/products/:id', requireAuth, attachStoreId, async (req, res) => {
  await knex('products').where({ id: req.params.id, storeId: req.storeId }).del();
  res.json({ ok: true });
});

// Option Groups e Options
router.get('/option-groups', requireAuth, attachStoreId, async (req, res) => {
  const groups = await knex('option_groups').where({ storeId: req.storeId });
  const options = await knex('options').where({ storeId: req.storeId });
  const byGroup = options.reduce((acc, op) => {
    if (!acc[op.groupId]) acc[op.groupId] = [];
    acc[op.groupId].push(op);
    return acc;
  }, {});
  res.json(groups.map(g => ({ ...g, options: byGroup[g.id] || [] })));
});
router.post('/option-groups', requireAuth, attachStoreId, async (req, res) => {
  const { name, min = 0, max = 1, required = false } = req.body;
  const [row] = await knex('option_groups').insert({ storeId: req.storeId, name, min, max, required: !!required }, ['id']);
  res.json({ id: row.id });
});
router.put('/option-groups/:id', requireAuth, attachStoreId, async (req, res) => {
  const { name, min, max, required } = req.body;
  await knex('option_groups').update({ name, min, max, required: !!required }).where({ id: req.params.id, storeId: req.storeId });
  res.json({ ok: true });
});
router.delete('/option-groups/:id', requireAuth, attachStoreId, async (req, res) => {
  await knex('option_groups').where({ id: req.params.id, storeId: req.storeId }).del();
  res.json({ ok: true });
});
router.post('/options', requireAuth, attachStoreId, async (req, res) => {
  const { groupId, name, price = 0 } = req.body;
  const [row] = await knex('options').insert({ storeId: req.storeId, groupId, name, price: Number(price) }, ['id']);
  res.json({ id: row.id });
});
router.put('/options/:id', requireAuth, attachStoreId, async (req, res) => {
  const { name, price } = req.body;
  await knex('options').update({ name, price: Number(price) }).where({ id: req.params.id, storeId: req.storeId });
  res.json({ ok: true });
});
router.delete('/options/:id', requireAuth, attachStoreId, async (req, res) => {
  await knex('options').where({ id: req.params.id, storeId: req.storeId }).del();
  res.json({ ok: true });
});

// Mesas e QR
router.get('/tables', requireAuth, attachStoreId, async (req, res) => {
  const rows = await knex('tables').where({ storeId: req.storeId });
  res.json(rows);
});
router.post('/tables', requireAuth, attachStoreId, async (req, res) => {
  const { name, active = true } = req.body;
  const [row] = await knex('tables').insert({ storeId: req.storeId, name, active: !!active }, ['id']);
  res.json({ id: row.id });
});
router.get('/tables/:id/qrcode', requireAuth, attachStoreId, async (req, res) => {
  const table = await knex('tables').where({ id: req.params.id, storeId: req.storeId }).first();
  if (!table) return res.status(404).send('Mesa não encontrada');
  const store = await knex('stores').where({ id: req.storeId }).first();
  const format = req.query.format === 'svg' ? 'svg' : 'png';
  const data = await generateTableQR({ baseUrl: config.baseUrl, storeSlug: store.slug, tableId: table.id, format });
  if (format === 'svg') {
    res.set('Content-Type', 'image/svg+xml');
    return res.send(data);
  }
  res.set('Content-Type', 'image/png');
  res.send(data);
});

// Pedidos (Admin)
router.get('/orders', requireAuth, attachStoreId, async (req, res) => {
  const { status } = req.query;
  let q = knex('orders').where({ storeId: req.storeId }).orderBy('createdAt', 'desc').limit(200);
  if (status) q = q.andWhere({ status });
  const orders = await q;
  res.json(orders);
});
router.put('/orders/:id/status', requireAuth, attachStoreId, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['accepted', 'in_kitchen', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const order = await knex('orders').where({ id, storeId: req.storeId }).first();
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  await knex('orders').update({ status }).where({ id });
  const updated = await knex('orders').where({ id }).first();
  const { publishToOrder, publishToStore } = require('../utils/sseHub');
  publishToOrder(order.publicId, { status: updated.status });
  publishToStore(req.storeId, { type: 'order_update', publicId: order.publicId, status: updated.status });
  res.json({ ok: true, status: updated.status });
});

// SSE do KDS/Admin
router.get('/orders/stream', requireAuth, attachStoreId, (req, res) => {
  subscribeStore(req.storeId, res);
});

module.exports = router;