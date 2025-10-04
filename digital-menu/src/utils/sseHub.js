// Hub simples para SSE: por pedido e por loja
const orderStreams = new Map(); // publicId -> Set(res)
const storeStreams = new Map(); // storeId -> Set(res)

function sseInit(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write('retry: 2000\n\n'); // reconectar após 2s
}

function subscribeOrder(publicId, res) {
  sseInit(res);
  if (!orderStreams.has(publicId)) orderStreams.set(publicId, new Set());
  orderStreams.get(publicId).add(res);
  res.on('close', () => {
    orderStreams.get(publicId)?.delete(res);
  });
}

function subscribeStore(storeId, res) {
  sseInit(res);
  if (!storeStreams.has(storeId)) storeStreams.set(storeId, new Set());
  storeStreams.get(storeId).add(res);
  res.on('close', () => {
    storeStreams.get(storeId)?.delete(res);
  });
}

function publishToOrder(publicId, payload) {
  const set = orderStreams.get(publicId);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) res.write(data);
}

function publishToStore(storeId, payload) {
  const set = storeStreams.get(storeId);
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) res.write(data);
}

module.exports = { subscribeOrder, subscribeStore, publishToOrder, publishToStore };