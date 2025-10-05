// SSE por loja (KDS/Admin)
const { sseHeaders, keepAlive } = require('./sse');

const storeClients = new Map(); // storeId -> Set(res)

function subscribeStore(storeId, res) {
  const key = String(storeId);
  if (!storeClients.has(key)) storeClients.set(key, new Set());
  storeClients.get(key).add(res);
}
function unsubscribeStore(storeId, res) {
  const key = String(storeId);
  const set = storeClients.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) storeClients.delete(key);
}
function broadcastStore(storeId, payload) {
  const key = String(storeId);
  const set = storeClients.get(key);
  if (!set) return;
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const res of set) {
    try { res.write(`data: ${data}\n\n`); } catch (_) {}
  }
}

function openStoreStream(res, storeId, initialPayload) {
  sseHeaders(res);
  res.flushHeaders?.();
  if (initialPayload) {
    const data = typeof initialPayload === 'string' ? initialPayload : JSON.stringify(initialPayload);
    res.write(`data: ${data}\n\n`);
  }
  subscribeStore(storeId, res);
  const ping = keepAlive(res);
  return () => {
    clearInterval(ping);
    unsubscribeStore(storeId, res);
  };
}

module.exports = { subscribeStore, unsubscribeStore, broadcastStore, openStoreStream };