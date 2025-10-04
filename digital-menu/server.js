process.env.TZ = process.env.TZ || 'America/Sao_Paulo';
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cors = require('cors');

const { knex } = require('./src/db');
const config = require('./src/config');

const publicRoutes = require('./src/routes/public');
const adminRoutes = require('./src/routes/admin');
const paymentsRoutes = require('./src/routes/payments');
const webhooksRoutes = require('./src/routes/webhooks');

const app = express();

// Segurança básica e logs
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({ origin: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Sessões
app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.join(__dirname, 'data') }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 } // 8h
}));

// Static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// APIs
app.use('/payments', paymentsRoutes);
app.use('/webhooks', webhooksRoutes);
app.use('/admin', adminRoutes);
app.use('/', publicRoutes);

// Rotas de páginas (HTML puro) – ordem importa
app.get('/admin/login', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html')));
app.get('/admin/:page', (req, res) => {
  const file = path.join(__dirname, 'public', 'admin', `${req.params.page}.html`);
  res.sendFile(file);
});

// QR: rota especial que seta mesa no localStorage e redireciona ao cardápio
app.get('/:storeSlug/m/:tableId', (req, res) => {
  const { storeSlug, tableId } = req.params;
  const redirectTo = `/${storeSlug}`;
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!doctype html><html><head><meta charset="utf-8"><title>Mesa</title></head>
    <body>
      <p>Carregando mesa...</p>
      <script>
        try {
          localStorage.setItem('currentTableId:${storeSlug}', '${tableId}');
        } catch(e) {}
        location.href = '${redirectTo}';
      </script>
    </body></html>
  `);
});

// Páginas públicas
app.get('/:storeSlug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'store.html'));
});
app.get('/:storeSlug/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});
app.get('/order/:publicId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'order.html'));
});

// Start
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em ${config.baseUrl} (porta ${port})`);
});