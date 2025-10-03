const rateLimit = require('express-rate-limit');

const strictApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120
});

module.exports = { strictApiLimiter };