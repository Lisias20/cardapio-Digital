// === dashboard.js ===

// 1️⃣  Define base da API (ajuste conforme servidor)
const apiBase = "http://localhost:3000/api";

/*
  2️⃣  Esta página mostra métricas e últimos pedidos.
  Vai chamar rotas admin que retornem estatísticas
  (total de pedidos, total de vendas, etc.) e as últimas transações.
*/

// ---------- FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO ----------

async function initDashboard() {
  // Busca as métricas iniciais
  await carregarMetricas();

  // Busca a listagem dos últimos pedidos
  await carregarUltimosPedidos();

  // Abre canal SSE para atualizar números em tempo real
  iniciarStreamAdmin();
}

// ---------- FUNÇÃO PARA OBTER MÉTRICAS GERAIS ----------

async function carregarMetricas() {
  try {
    // Este endpoint é hipotético, ajuste conforme seu backend `/admin/stats`
    const res = await fetch(`${apiBase}/admin/stats`);
    const data = await res.json();

    if (!res.ok) {
      console.error("Falha ao carregar métricas:", data);
      return;
    }

    // Atualiza elementos na tela
    renderizarMetricas(data);
  } catch (err) {
    console.error("Erro de rede ao carregar métricas:", err);
  }
}

// ---------- MOSTRA MÉTRICAS NA TELA ----------

function renderizarMetricas(m) {
  const cont = document.getElementById("dash-metrics");

  // Cria blocos de indicadores
  cont.innerHTML = `
    <div class="metric-card">
      <h3>Pedidos Hoje</h3>
      <p>${m.ordersToday || 0}</p>
    </div>
    <div class="metric-card">
      <h3>Vendas Hoje</h3>
      <p>R$ ${(m.salesToday/100 || 0).toFixed(2).replace('.', ',')}</p>
    </div>
    <div class="metric-card">
      <h3>Pedidos Abertos</h3>
      <p>${m.pendingOrders || 0}</p>
    </div>
    <div class="metric-card">
      <h3>Clientes Ativos</h3>
      <p>${m.activeCustomers || 0}</p>
    </div>
  `;
}

// ---------- BUSCA PEDIDOS RECENTES ----------

async function carregarUltimosPedidos() {
  try {
    // Endpoint de exemplo: `/admin/orders?limit=10`
    const res = await fetch(`${apiBase}/admin/orders?limit=10`);
    const data = await res.json();

    if (!res.ok) {
      console.error("Erro ao carregar últimos pedidos");
      return;
    }

    // Monta visual
    renderizarUltimosPedidos(data);
  } catch (err) {
    console.error("Erro ao buscar pedidos:", err);
  }
}

// ---------- RENDERIZA LISTAGEM DE PEDIDOS NO HTML ----------

function renderizarUltimosPedidos(pedidos) {
  const cont = document.getElementById("last-orders");

  // Se não houver pedidos
  if (!pedidos || pedidos.length === 0) {
    cont.innerHTML = "<p>Nenhum pedido ainda.</p>";
    return;
  }

  // Cria linha por linha
  cont.innerHTML = pedidos
    .map(
      (p) => `
      <div class="dash-order-item">
        <span>#${p.id}</span>
        <span>${p.type}</span>
        <span>${p.status}</span>
        <span>R$ ${(p.total/100).toFixed(2).replace('.', ',')}</span>
      </div>`
    )
    .join("");
}

// ---------- SSE: ATUALIZAÇÃO EM TEMPO REAL ----------

function iniciarStreamAdmin() {
  // Supondo que backend tenha broadcast da loja
  const storeId = 1;
  const sse = new EventSource(`${apiBase}/store/${storeId}/stream`);

  // Toda atualização recebida será tratada aqui
  sse.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Quando um novo pedido chega
      if (data.kind === "order_created") {
        // Recarrega métricas e últimos pedidos
        carregarMetricas();
        carregarUltimosPedidos();
      }
    } catch (err) {
      console.error("Falha ao interpretar SSE:", err);
    }
  };

  sse.onerror = (err) => {
    console.warn("Erro no canal SSE:", err);
    sse.close();
  };
}

// ---------- EXECUTA INITIALIZAÇÃO QUANDO O DASHBOARD CARREGA ----------
initDashboard();