require('dotenv').config();
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 3000);
const TZ = process.env.TZ || 'America/Sao_Paulo';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.resolve(ROOT_DIR, '..', 'data');
const UPLOADS_DIR = path.resolve(ROOT_DIR, '..', 'uploads');
const PUBLIC_DIR = path.resolve(ROOT_DIR, '..', 'public');

const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_change_me';

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY || '';
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || '';

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