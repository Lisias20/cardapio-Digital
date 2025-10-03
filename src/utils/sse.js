/**
 * Broker simples de SSE por orderId
 */
class SSEBroker {
  constructor() {
    this.clientsByOrder = new Map(); // orderId -> Set(res)
  }

  subscribe(orderId, res) {
    if (!this.clientsByOrder.has(orderId)) {
      this.clientsByOrder.set(orderId, new Set());
    }
    this.clientsByOrder.get(orderId).add(res);

    // Keep-alive ping
    const interval = setInterval(() => {
      try { res.write(`: ping\n\n`); } catch {}
    }, 30000);
    res.on('close', () => {
      clearInterval(interval);
      this.clientsByOrder.get(orderId)?.delete(res);
    });
  }

  publish(orderId, data) {
    const clients = this.clientsByOrder.get(orderId);
    if (!clients) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try { res.write(payload); } catch {}
    }
  }
}

module.exports = new SSEBroker();