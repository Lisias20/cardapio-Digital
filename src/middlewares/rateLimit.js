// Rate limit leve em memória (suficiente para MVP)
const buckets = new Map();

function rateLimit({ windowMs = 60000, max = 60, keyGenerator } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = (typeof keyGenerator === 'function' && keyGenerator(req)) || `${req.ip}:${req.path}`;
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.reset) {
      bucket = { count: 0, reset: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(bucket.reset / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({ message: 'Muitas requisições. Tente novamente em instantes.' });
    }
    next();
  };
}

module.exports = { rateLimit };