// SSE por pedido (cliente acompanha pagamento/status)
const clientsByOrder = new Map(); // orderId -> Set(res)

function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
}

function subscribe(orderId, res) {
  const key = String(orderId);
  if (!clientsByOrder.has(key)) clientsByOrder.set(key, new Set());
  clientsByOrder.get(key).add(res);
}

function unsubscribe(orderId, res) {
  const key = String(orderId);
  const set = clientsByOrder.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clientsByOrder.delete(key);
}

function broadcast(orderId, payload) {
  const key = String(orderId);
  const set = clientsByOrder.get(key);
  if (!set) return;
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const res of set) {
    try { res.write(`data: ${data}\n\n`); } catch (_) {}
  }
}

function keepAlive(res) {
  const id = setInterval(() => {
    try { res.write(':\n\n'); } catch (_) {}
  }, 15000);
  return id;
}

module.exports = { sseHeaders, subscribe, unsubscribe, broadcast, keepAlive };