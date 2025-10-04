const toIsoLocal = (d = new Date()) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString();

module.exports = { toIsoLocal };