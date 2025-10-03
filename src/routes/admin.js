const express = require('express');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = require('../db/knex');
const { requireAuth, getUser } = require('../middleware/auth');
const sse = require('../utils/sse');
const { generateQR } = require('../utils/qrcode');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads') });

// Auth
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, storeSlug } = req.body;
    const store = await db('stores').where({ slug: storeSlug }).first();
    if (!store) return res.status(400).json({ error: 'Loja inválida' });
    const user = await db('users').where({ email, storeId: store.id }).first();
    if (!user) return res.status(400).json({ error: 'Credenciais inválidas' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Credenciais inválidas' });
    req.session.user = { id: user.id, email: user.email, storeId: user.storeId, role: user.role };
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: getUser(req) });
});

// Store config
router.get('/store', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const store = await db('stores').where({ id: storeId }).first();
    res.json({ store });
  } catch (e) { next(e); }
});

router.put('/store', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const allowed = ['name', 'logoUrl', 'themePrimary', 'deliveryRadiusKm', 'deliveryFee', 'packagingFee', 'openHours'];
    const payload = {};
    for (const k of allowed) if (k in req.body) payload[k] = req.body[k];
    payload.updatedAt = db.fn.now();
    await db('stores').where({ id: storeId }).update(payload);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Categories CRUD
router.get('/categories', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const rows = await db('categories').where({ storeId }).orderBy('position', 'asc');
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/categories', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const id = uuid();
    const { name, position } = req.body;
    await db('categories').insert({ id, storeId, name, position: position || 0 });
    res.status(201).json({ id });
  } catch (e) { next(e); }
});

router.put('/categories/:id', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const { id } = req.params;
    const { name, position } = req.body;
    await db('categories').where({ id, storeId }).update({ name, position });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/categories/:id', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    await db('categories').where({ id: req.params.id, storeId }).del();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Products CRUD
router.get('/products', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const rows = await db('products').where({ storeId });
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/products', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const id = uuid();
    const { name, description, price, categoryId } = req.body;
    const imageUrl = req.file ? `/uploads/${path.basename(req.file.path)}` : null;
    await db('products').insert({
      id, storeId, categoryId, name, description: description || '', price: parseInt(price, 10), imageUrl, active: 1
    });
    res.status(201).json({ id, imageUrl });
  } catch (e) { next(e); }
});

router.put('/products/:id', requireAuth, upload.single('image'), async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const { id } = req.params;
    const { name, description, price, categoryId, active } = req.body;
    const patch = { name, description, price: parseInt(price, 10), categoryId, active: active ? 1 : 0 };
    if (req.file) patch.imageUrl = `/uploads/${path.basename(req.file.path)}`;
    await db('products').where({ id, storeId }).update(patch);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/products/:id', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    await db('products').where({ id: req.params.id, storeId }).del();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Option Groups & Options
router.get('/option-groups', requireAuth, async (req, res, next) => {
  const { storeId } = getUser(req);
  const groups = await db('option_groups').where({ storeId });
  const options = await db('options').where({ storeId });
  res.json({ groups, options });
});

router.post('/option-groups', requireAuth, async (req, res, next) => {
  const { storeId } = getUser(req);
  const id = uuid();
  const { name, min, max, required } = req.body;
  await db('option_groups').insert({ id, storeId, name, min: +min || 0, max: +max || 1, required: !!required });
  res.status(201).json({ id });
});

router.post('/options', requireAuth, async (req, res, next) => {
  const { storeId } = getUser(req);
  const id = uuid();
  const { groupId, name, price } = req.body;
  await db('options').insert({ id, storeId, groupId, name, price: +price || 0 });
  res.status(201).json({ id });
});

// Tables & QR
router.get('/tables', requireAuth, async (req, res, next) => {
  const { storeId } = getUser(req);
  const rows = await db('tables').where({ storeId });
  res.json(rows);
});

router.post('/tables', requireAuth, async (req, res, next) => {
  const { storeId } = getUser(req);
  const id = uuid();
  const { name } = req.body;
  await db('tables').insert({ id, storeId, name, active: 1 });
  res.status(201).json({ id });
});

router.get('/tables/:id/qrcode', requireAuth, async (req, res, next) => {
  try {
    const { storeId } = getUser(req);
    const table = await db('tables').where({ id: req.params.id, storeId }).first();
    if (!table) return res.status(404).send('Mesa não encontrada');
    const store = await db('stores').where({ id: storeId }).first();
    const nonce = uuid().slice(0, 8);
    const url = `${process.env.BASE_URL}/${store.slug}/m/${table.id}?t=${nonce}`;
    const base64 = await generateQR(url, 'png');
    const buf = Buffer.from(base64, 'base64');
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch (e) { next(e); }
});

// Orders list/status
router.get('/orders', requireAuth, async (req, res, next) => {
  const { storeId } = getUser(req);
  const { status } = req.query;
  let q = db('orders').where({ storeId }).orderBy('createdAt', 'desc');
  if (status) q = q.andWhere({ status });
  const orders = await q;
  res.json(orders);
});

router.put('/orders/:id/status', requireAuth, async (req, res, next) => {
  const { storeId } = getUser(req);
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['received','accepted','in_kitchen','ready','out_for_delivery','delivered','cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  await db('orders').where({ id, storeId }).update({ status, updatedAt: db.fn.now() });

  // Notifica SSE
  sse.publish(id, { type: 'status', status });
  res.json({ ok: true });
});

module.exports = router;