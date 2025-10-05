const express = require('express');
const path = require('path');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const QRCode = require('qrcode');

const { knex, now } = require('../utils/db');
const { rateLimit } = require('../middlewares/rateLimit');
const { requireAuth, requireStoreScope } = require('../middlewares/auth');
const { UPLOADS_DIR, BASE_URL } = require('../utils/config');
const { openStoreStream, broadcastStore } = require('../utils/bus');
const { broadcast } = require('../utils/sse');

const router = express.Router();

/* =========================
   Uploads (imagens)
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = String(file.originalname || 'file')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_.]/g, '');
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${base}`.slice(0, 80);
    cb(null, name.endsWith(ext) ? name : `${name}${ext}`);
  }
});
const fileFilter = (req, file, cb) => {
  if (!file.mimetype?.startsWith('image/')) return cb(new Error('Arquivo inválido (somente imagens).'));
  cb(null, true);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

/* =========================
   Helpers
========================= */
const ORDER_STATUSES = [
  'received', 'accepted', 'in_kitchen', 'ready',
  'out_for_delivery', 'delivered', 'cancelled'
];

function parseCents(input) {
  if (input === null || input === undefined || input === '') return 0;
  if (typeof input === 'number') {
    // Se parecer já estar em centavos, retorna inteiro
    if (Number.isInteger(input)) return Math.max(0, input);
    return Math.max(0, Math.round(input * 100));
  }
  const str = String(input).replace(/\s/g, '').replace(',', '.');
  if (str.includes('.')) return Math.max(0, Math.round(Number(str) * 100));
  const n = Number(str);
  return Math.max(0, Math.round(n));
}

/* =========================
   Auth
========================= */
router.post('/admin/login',
  rateLimit({ windowMs: 60_000, max: 20, keyGenerator: req => `login:${req.ip}` }),
  async (req, res) => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(4).required()
    });
    try {
      const { email, password } = await schema.validateAsync(req.body, { stripUnknown: true });
      const user = await knex('users').whereRaw('lower(email) = lower(?)', [email]).first();
      if (!user) return res.status(401).json({ message: 'Credenciais inválidas' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Credenciais inválidas' });

      const store = await knex('stores').where({ id: user.storeId }).first();

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        storeId: user.storeId
      };

      res.json({
        user: { id: user.id, email: user.email, role: user.role },
        store: store ? {
          id: store.id, name: store.name, slug: store.slug,
          logoUrl: store.logoUrl, themePrimary: store.themePrimary
        } : null
      });
    } catch (err) {
      res.status(400).json({ message: err.message || 'Erro ao autenticar' });
    }
  }
);

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/admin/me', requireAuth, requireStoreScope, async (req, res) => {
  const user = await knex('users').where({ id: req.session.user.id }).first();
  const store = await knex('stores').where({ id: req.storeId }).first();
  if (!user || !store) return res.status(401).json({ message: 'Sessão inválida' });
  res.json({
    user: { id: user.id, email: user.email, role: user.role },
    store
  });
});

/* =========================
   Store config
========================= */
router.get('/admin/store', requireAuth, requireStoreScope, async (req, res) => {
  const store = await knex('stores').where({ id: req.storeId }).first();
  if (!store) return res.status(404).json({ message: 'Loja não encontrada' });
  res.json(store);
});

router.put('/admin/store', requireAuth, requireStoreScope, upload.single('logo'), async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(120).optional(),
    themePrimary: Joi.string().max(32).optional(),
    cnpj: Joi.string().max(32).allow('', null),
    openHours: Joi.any().optional(), // string JSON ou objeto
    deliveryRadiusKm: Joi.number().min(0).max(100).optional(),
    deliveryFee: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
    packagingFee: Joi.alternatives().try(Joi.number(), Joi.string()).optional()
  });

  try {
    const body = await schema.validateAsync(req.body, { stripUnknown: true });
    const patch = {};
    if (body.name != null) patch.name = body.name;
    if (body.themePrimary != null) patch.themePrimary = body.themePrimary;
    if (body.cnpj != null) patch.cnpj = body.cnpj || null;
    if (body.openHours != null) {
      patch.openHours = typeof body.openHours === 'string'
        ? body.openHours
        : JSON.stringify(body.openHours || {});
    }
    if (body.deliveryRadiusKm != null) patch.deliveryRadiusKm = Number(body.deliveryRadiusKm);
    if (body.deliveryFee != null) patch.deliveryFee = parseCents(body.deliveryFee);
    if (body.packagingFee != null) patch.packagingFee = parseCents(body.packagingFee);
    if (req.file) patch.logoUrl = `/uploads/${req.file.filename}`;

    patch.updatedAt = now();

    await knex('stores').where({ id: req.storeId }).update(patch);
    const updated = await knex('stores').where({ id: req.storeId }).first();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao atualizar loja' });
  }
});

/* =========================
   Categories
========================= */
router.get('/admin/categories', requireAuth, requireStoreScope, async (req, res) => {
  const rows = await knex('categories').where({ storeId: req.storeId }).orderBy('position', 'asc');
  res.json(rows);
});

router.post('/admin/categories', requireAuth, requireStoreScope, async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(80).required(),
    position: Joi.number().integer().min(0).optional()
  });
  try {
    const body = await schema.validateAsync(req.body, { stripUnknown: true });
    let pos = body.position;
    if (pos == null) {
      const max = await knex('categories').where({ storeId: req.storeId }).max('position as m').first();
      pos = (max?.m ?? 0) + 1;
    }
    const [id] = await knex('categories').insert({ storeId: req.storeId, name: body.name, position: pos });
    const created = await knex('categories').where({ id }).first();
    res.json(created);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao criar categoria' });
  }
});

router.put('/admin/categories/:id', requireAuth, requireStoreScope, async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(80).optional(),
    position: Joi.number().integer().min(0).optional()
  });
  try {
    const { id } = req.params;
    const patch = await schema.validateAsync(req.body, { stripUnknown: true });
    const ok = await knex('categories').where({ id, storeId: req.storeId }).update(patch);
    if (!ok) return res.status(404).json({ message: 'Categoria não encontrada' });
    const updated = await knex('categories').where({ id }).first();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao atualizar categoria' });
  }
});

router.delete('/admin/categories/:id', requireAuth, requireStoreScope, async (req, res) => {
  try {
    const { id } = req.params;
    const hasProduct = await knex('products').where({ storeId: req.storeId, categoryId: id }).first();
    if (hasProduct) return res.status(409).json({ message: 'Remova ou mova os produtos desta categoria antes.' });
    const ok = await knex('categories').where({ id, storeId: req.storeId }).del();
    if (!ok) return res.status(404).json({ message: 'Categoria não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao excluir categoria' });
  }
});

/* =========================
   Products
========================= */
router.get('/admin/products', requireAuth, requireStoreScope, async (req, res) => {
  const rows = await knex('products').where({ storeId: req.storeId }).orderBy('id', 'asc');
  res.json(rows);
});

router.post('/admin/products', requireAuth, requireStoreScope, upload.single('image'), async (req, res) => {
  const schema = Joi.object({
    categoryId: Joi.number().integer().required(),
    name: Joi.string().min(2).max(120).required(),
    description: Joi.string().allow('', null),
    price: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
    active: Joi.boolean().default(true)
  });
  try {
    const body = await schema.validateAsync(req.body, { stripUnknown: true });

    const product = {
      storeId: req.storeId,
      categoryId: body.categoryId,
      name: body.name,
      description: body.description || '',
      price: parseCents(body.price),
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
      active: body.active ? 1 : 0
    };

    const [id] = await knex('products').insert(product);
    const created = await knex('products').where({ id }).first();
    res.json(created);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao criar produto' });
  }
});

router.put('/admin/products/:id', requireAuth, requireStoreScope, upload.single('image'), async (req, res) => {
  const schema = Joi.object({
    categoryId: Joi.number().integer().optional(),
    name: Joi.string().min(1).max(120).optional(),
    description: Joi.string().allow('', null),
    price: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
    active: Joi.boolean().optional()
  });
  try {
    const { id } = req.params;
    const body = await schema.validateAsync(req.body, { stripUnknown: true });

    const patch = {};
    if (body.categoryId != null) patch.categoryId = body.categoryId;
    if (body.name != null) patch.name = body.name;
    if (body.description != null) patch.description = body.description || '';
    if (body.price != null) patch.price = parseCents(body.price);
    if (body.active != null) patch.active = body.active ? 1 : 0;
    if (req.file) patch.imageUrl = `/uploads/${req.file.filename}`;

    const ok = await knex('products').where({ id, storeId: req.storeId }).update(patch);
    if (!ok) return res.status(404).json({ message: 'Produto não encontrado' });
    const updated = await knex('products').where({ id }).first();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao atualizar produto' });
  }
});

// Soft delete (marca inativo)
router.delete('/admin/products/:id', requireAuth, requireStoreScope, async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await knex('products').where({ id, storeId: req.storeId }).update({ active: 0 });
    if (!ok) return res.status(404).json({ message: 'Produto não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao excluir produto' });
  }
});

/* =========================
   Option Groups & Options
========================= */
router.get('/admin/option-groups', requireAuth, requireStoreScope, async (req, res) => {
  const rows = await knex('option_groups').where({ storeId: req.storeId }).orderBy('id', 'asc');
  res.json(rows);
});

router.post('/admin/option-groups', requireAuth, requireStoreScope, async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(80).required(),
    min: Joi.number().integer().min(0).default(0),
    max: Joi.number().integer().min(0).default(1),
    required: Joi.boolean().default(false)
  });
  try {
    const body = await schema.validateAsync(req.body, { stripUnknown: true });
    const [id] = await knex('option_groups').insert({
      storeId: req.storeId,
      name: body.name,
      min: body.min,
      max: body.max,
      required: body.required ? 1 : 0
    });
    const created = await knex('option_groups').where({ id }).first();
    res.json(created);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao criar grupo' });
  }
});

router.put('/admin/option-groups/:id', requireAuth, requireStoreScope, async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(80).optional(),
    min: Joi.number().integer().min(0).optional(),
    max: Joi.number().integer().min(0).optional(),
    required: Joi.boolean().optional()
  });
  try {
    const { id } = req.params;
    const body = await schema.validateAsync(req.body, { stripUnknown: true });
    const patch = { ...body };
    if (patch.required != null) patch.required = patch.required ? 1 : 0;

    const ok = await knex('option_groups').where({ id, storeId: req.storeId }).update(patch);
    if (!ok) return res.status(404).json({ message: 'Grupo não encontrado' });

    const updated = await knex('option_groups').where({ id }).first();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao atualizar grupo' });
  }
});

router.delete('/admin/option-groups/:id', requireAuth, requireStoreScope, async (req, res) => {
  try {
    const { id } = req.params;
    // Se tiver options, remova-as antes (há FK com CASCADE, mas melhor sinalizar)
    const has = await knex('options').where({ groupId: id, storeId: req.storeId }).first();
    if (has) return res.status(409).json({ message: 'Remova as opções deste grupo antes.' });
    const ok = await knex('option_groups').where({ id, storeId: req.storeId }).del();
    if (!ok) return res.status(404).json({ message: 'Grupo não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao excluir grupo' });
  }
});

router.get('/admin/options', requireAuth, requireStoreScope, async (req, res) => {
  const { groupId } = req.query;
  const q = knex('options').where({ storeId: req.storeId }).orderBy('id', 'asc');
  if (groupId) q.andWhere({ groupId: Number(groupId) });
  const rows = await q;
  res.json(rows);
});

router.post('/admin/options', requireAuth, requireStoreScope, async (req, res) => {
  const schema = Joi.object({
    groupId: Joi.number().integer().required(),
    name: Joi.string().min(1).max(80).required(),
    price: Joi.alternatives().try(Joi.number(), Joi.string()).default(0)
  });
  try {
    const body = await schema.validateAsync(req.body, { stripUnknown: true });

    const grp = await knex('option_groups').where({ id: body.groupId, storeId: req.storeId }).first();
    if (!grp) return res.status(400).json({ message: 'Grupo inválido' });

    const [id] = await knex('options').insert({
      storeId: req.storeId,
      groupId: body.groupId,
      name: body.name,
      price: parseCents(body.price)
    });
    const created = await knex('options').where({ id }).first();
    res.json(created);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao criar opção' });
  }
});

router.put('/admin/options/:id', requireAuth, requireStoreScope, async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(1).max(80).optional(),
    price: Joi.alternatives().try(Joi.number(), Joi.string()).optional()
  });
  try {
    const { id } = req.params;
    const body = await schema.validateAsync(req.body, { stripUnknown: true });

    const patch = {};
    if (body.name != null) patch.name = body.name;
    if (body.price != null) patch.price = parseCents(body.price);

    const ok = await knex('options').where({ id, storeId: req.storeId }).update(patch);
    if (!ok) return res.status(404).json({ message: 'Opção não encontrada' });

    const updated = await knex('options').where({ id }).first();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao atualizar opção' });
  }
});

router.delete('/admin/options/:id', requireAuth, requireStoreScope, async (req, res) => {
  try {
    const { id } = req.params;
    const ok = await knex('options').where({ id, storeId: req.storeId }).del();
    if (!ok) return res.status(404).json({ message: 'Opção não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao excluir opção' });
  }
});

/* =========================
   Tables & QR
========================= */
router.get('/admin/tables', requireAuth, requireStoreScope, async (req, res) => {
  const rows = await knex('tables').where({ storeId: req.storeId }).orderBy('id', 'asc');
  res.json(rows);
});

router.post('/admin/tables', requireAuth, requireStoreScope, async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().allow('', null),
    number: Joi.string().allow('', null),
    active: Joi.boolean().default(true)
  });
  try {
    const body = await schema.validateAsync(req.body, { stripUnknown: true });
    const [id] = await knex('tables').insert({
      storeId: req.storeId,
      name: body.name || null,
      number: body.number || null,
      active: body.active ? 1 : 0
    });
    const created = await knex('tables').where({ id }).first();
    res.json(created);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao criar mesa' });
  }
});

router.get('/admin/tables/:id/qrcode', requireAuth, requireStoreScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { fmt = 'png', size = 256 } = req.query;

    const table = await knex('tables').where({ id, storeId: req.storeId }).first();
    if (!table) return res.status(404).send('Mesa não encontrada');

    const store = await knex('stores').where({ id: req.storeId }).first();
    const url = `${BASE_URL}/${store.slug}/m/${table.id}?t=${Date.now().toString(36)}`;

    if (fmt === 'svg') {
      const svg = await QRCode.toString(url, { type: 'svg', width: Number(size) || 256, errorCorrectionLevel: 'M' });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }

    const buf = await QRCode.toBuffer(url, { type: 'png', width: Number(size) || 256, errorCorrectionLevel: 'M' });
    res.setHeader('Content-Type', 'image/png');
    res.send(buf);
  } catch (err) {
    console.error('QR erro', err);
    res.status(500).send('Erro ao gerar QR');
  }
});

/* =========================
   Orders + KDS (SSE)
========================= */
router.get('/admin/orders', requireAuth, requireStoreScope, async (req, res) => {
  const { status, paymentStatus, type, limit } = req.query;
  const q = knex('orders').where({ storeId: req.storeId });

  if (status) q.whereIn('status', String(status).split(',').filter(Boolean));
  if (paymentStatus) q.whereIn('paymentStatus', String(paymentStatus).split(',').filter(Boolean));
  if (type) q.whereIn('type', String(type).split(',').filter(Boolean));

  q.orderBy('createdAt', 'desc').limit(Number(limit || 200));

  const rows = await q;
  res.json(rows);
});

router.put('/admin/orders/:id/status', requireAuth, requireStoreScope, async (req, res) => {
  const schema = Joi.object({
    status: Joi.string().valid(...ORDER_STATUSES).required()
  });
  try {
    const { id } = req.params;
    const { status } = await schema.validateAsync(req.body, { stripUnknown: true });

    const order = await knex('orders').where({ id, storeId: req.storeId }).first();
    if (!order) return res.status(404).json({ message: 'Pedido não encontrado' });

    await knex('orders').where({ id }).update({ status, updatedAt: now() });
    const updated = await knex('orders').where({ id }).first();

    // Notifica cliente e KDS/Admin
    broadcast(id, { id: updated.id, status: updated.status, paymentStatus: updated.paymentStatus, updatedAt: updated.updatedAt });
    broadcastStore(req.storeId, { kind: 'order_status', orderId: updated.id, status: updated.status, paymentStatus: updated.paymentStatus, updatedAt: updated.updatedAt });

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Falha ao atualizar status' });
  }
});

// SSE para KDS/Admin
router.get('/admin/orders/stream', requireAuth, requireStoreScope, async (req, res) => {
  try {
    const open = await knex('orders')
      .where({ storeId: req.storeId })
      .andWhere(builder => {
        builder.whereNotIn('status', ['delivered', 'cancelled'])
          .orWhere('createdAt', '>', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString());
      })
      .orderBy('createdAt', 'asc');

    const close = openStoreStream(res, req.storeId, { kind: 'snapshot', at: new Date().toISOString(), orders: open });
    req.on('close', close);
  } catch (err) {
    console.error('SSE admin stream erro', err);
    res.status(500).end();
  }
});

module.exports = router;