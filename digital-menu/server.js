process.env.TZ = process.env.TZ || 'America/Sao_Paulo';
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const db = require('./src/db/knex');
const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');
const mpRoutes = require('./src/routes/payments_mercadopago');

const app = express();

// Segurança básica
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Sessões para admin
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './' }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8h
}));

// Static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Rate limits de segurança básica
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });

// Config pública (ex: MP public key, tema default)
app.get('/config/public', (req, res) => {
  res.json({
    mpPublicKey: process.env.MP_PUBLIC_KEY || '',
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`
  });
});

// APIs
app.use('/', publicRoutes);
app.use('/admin', loginLimiter, adminRoutes);
app.use('/', webhookLimiter, mpRoutes);

// Páginas públicas dinâmicas (servem HTML; JS consome a API)
app.get('/:storeSlug', (req, res, next) => {
  // Evitar conflito com /admin, /payments, /webhooks, /static, /uploads
  const reserved = ['admin', 'payments', 'webhooks', 'static', 'uploads', 'config', 'orders'];
  if (reserved.includes(req.params.storeSlug)) return next();
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/:storeSlug/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

app.get('/order/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'order.html'));
});

// Healthcheck
app.get('/health', async (req, res) => {
  try {
    await db.raw('select 1+1 as result');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});