function s(input) {
  if (typeof input === 'string') return input.trim();
  return input;
}
function sanitizeObject(obj, fields) {
  const out = {};
  fields.forEach(f => { if (obj[f] !== undefined) out[f] = s(obj[f]); });
  return out;
}
module.exports = { s, sanitizeObject };