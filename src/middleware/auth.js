module.exports = {
  requireAuth: (req, res, next) => {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: 'Não autenticado' });
  },
  getUser: (req) => req.session?.user || null
};