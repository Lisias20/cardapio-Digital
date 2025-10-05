function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ message: 'Não autenticado' });
  next();
}
function requireStoreScope(req, res, next) {
  if (!req.session?.user?.storeId) return res.status(403).json({ message: 'Loja não vinculada à sessão' });
  req.storeId = req.session.user.storeId;
  next();
}
function requireAdminRole(req, res, next) {
  if (!req.session?.user || !['admin', 'staff'].includes(req.session.user.role)) {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  next();
}

module.exports = { requireAuth, requireStoreScope, requireAdminRole };