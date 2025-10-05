require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const session = require('express-session');
const ConnectSqlite3 = require('connect-sqlite3')(session);

const {
  PORT, TZ, DATA_DIR, UPLOADS_DIR, PUBLIC_DIR, SESSION_SECRET
} = require('./src/utils/config');

process.env.TZ = TZ;

// Garante diretórios
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();

// Segurança básica
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // liberado por causa do SDK do Mercado Pago no front
}));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Sessão (SQLite)
app.use(session({
  store: new ConnectSqlite3({
    dir: DATA_DIR,
    db: 'sessions.sqlite',
    concurrentDB: true
  }),
  name: 'sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8 // 8h
  }
}));

// Estáticos
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

// Rotas (serão criadas nas próximas partes)
const publicRouter = require('./src/routes/public');      // menu, checkout/quote, orders, SSE
const paymentsRouter = require('./src/routes/payments');  // intent (pix/card)
const webhooksRouter = require('./src/routes/webhooks');  // webhook MP
const adminRouter = require('./src/routes/admin');        // auth + CRUD

app.use(publicRouter);
app.use(paymentsRouter);
app.use(webhooksRouter);
app.use(adminRouter);

// Páginas Admin (HTML puro)
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'login.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'dashboard.html'));
});
app.get('/admin/menu', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'menu.html'));
});
app.get('/admin/orders', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'orders.html'));
});
app.get('/admin/kds', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'kds.html'));
});
app.get('/admin/tables', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'tables.html'));
});
app.get('/admin/store', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin', 'store.html'));
});

// Páginas públicas
app.get('/:storeSlug/checkout', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'checkout.html'));
});
app.get('/order/:id', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'order.html'));
});
app.get('/:storeSlug', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'store.html'));
});

// QR por mesa: seta contexto no localStorage e redireciona
app.get('/:storeSlug/m/:tableId', (req, res) => {
  const { storeSlug, tableId } = req.params;
  const nonce = req.query.t || '';
  res.type('html').send(`
<!doctype html>
<meta charset="utf-8">
<title>Redirecionando…</title>
<body style="font-family: system-ui; padding: 24px;">
  <p>Conectando você à mesa ${tableId}…</p>
  <script>
    try {
      const key = 'table_' + ${JSON.stringify(storeSlug)};
      localStorage.setItem(key, ${JSON.stringify(String(tableId))});
    } catch(e) {}
    // Por padrão, vai à home do cardápio
    location.replace('/${storeSlug}');
  </script>
</body>
  `);
});

// 404 de API
app.use((req, res, next) => {
  if (req.accepts('html')) return res.status(404).send('Página não encontrada');
  res.status(404).json({ message: 'Rota não encontrada' });
});

// Erro
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Erro]', err);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor ouvindo em http://localhost:${PORT}`);
});