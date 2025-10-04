function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Não autenticado' });
}

function attachStoreId(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Não autenticado' });
  req.storeId = req.session.user.storeId;
  next();
}

module.exports = { requireAuth, attachStoreId };