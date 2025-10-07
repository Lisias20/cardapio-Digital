require('dotenv').config();
const path = require('path');

/**
 * Ambiente e configurações básicas
 */
const env = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 3000);
const TZ = process.env.TZ || 'America/Sao_Paulo';

/**
 * Diretórios raiz
 *
 * __dirname → .../cardapio-Digital/src/utils
 * ROOT_DIR  → .../cardapio-Digital
 */
const ROOT_DIR = path.resolve(__dirname, '..', '..');

/**
 * Pastas principais dentro do projeto (sem subir mais um nível!)
 */
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

/**
 * Outras variáveis e tokens
 */
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_change_me';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY || '';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

/**
 * Exporta tudo
 */
module.exports = {
  env,
  PORT,
  TZ,
  ROOT_DIR,
  DATA_DIR,
  UPLOADS_DIR,
  PUBLIC_DIR,
  BASE_URL,
  SESSION_SECRET,
  MP_ACCESS_TOKEN,
  MP_PUBLIC_KEY,
  MP_WEBHOOK_SECRET
};