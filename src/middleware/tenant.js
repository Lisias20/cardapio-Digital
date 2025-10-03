const db = require('../db/knex');

async function loadStoreBySlug(req, res, next) {
  try {
    const { storeSlug } = req.params;
    const store = await db('stores').where({ slug: storeSlug }).first();
    if (!store) return res.status(404).json({ error: 'Loja não encontrada' });
    req.store = store;
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { loadStoreBySlug };