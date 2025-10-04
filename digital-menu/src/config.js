require('dotenv').config();

module.exports = {
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  env: process.env.NODE_ENV || 'development',
  mp: {
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    publicKey: process.env.MP_PUBLIC_KEY || '',
    webhookSecret: process.env.MP_WEBHOOK_SECRET || ''
  }
};