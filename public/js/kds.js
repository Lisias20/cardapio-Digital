// === kds.js ===

// URL da API (ajuste conforme seu backend)
const apiBase = "http://localhost:3000/api";

/* 
  1️⃣ Este arquivo cria a tela da cozinha.
  Ele escuta eventos em tempo real (SSE) de todos os pedidos da loja,
  e também permite mudar o status deles.
*/

// ----------- Função principal de inicialização -----------

async function initKDS() {
  // Pega a lista inicial de pedidos ativos
  await carregarPedidos();

  // Em seguida, abre o canal SSE para receber novos pedidos instantaneamente
  iniciarStreamDaLoja();
}

// ----------- Busca pedidos atuais -----------

async function carregarPedidos() {
  try {
    // Esta rota seria /api/admin/orders ou similar (ajuste conforme seu backend)
    const res = await fetch(`${apiBase}/admin/orders`);
    const data = await res.json();

    if (!res.ok) {
      console.error("Falha ao carregar pedidos.");
      return;
    }
    renderizarPedidos(data);
  } catch (err) {
    console.error("Erro carregando pedidos:", err);
  }
}

// ----------- Renderiza visualmente cada pedido -----------

function renderizarPedidos(pedidos) {
  // Seleciona container onde os cartões serão mostrados
  const container = document.getElementById("orders-container");
  container.innerHTML = "";

  // Percorre cada pedido ativo
  pedidos.forEach(p => {
    // Cria o cartão
    const card = document.createElement("div");
    card.className = "kds-card";
    card.id = `pedido-${p.id}`;

    // Cabeçalho com ID e tipo
    card.innerHTML = `
      <h3>#${p.id}</h3>
      <p><strong>${p.type}</strong> • Total: R$ ${(p.total/100).toFixed(2).replace('.', ',')}</p>
      <p>Status: <span class="kds-status">${p.status}</span></p>
      <div class="kds-itens"></div>
      <div class="kds-actions">
        <button class="kds-btn ready">Preparar</button>
        <button class="kds-btn delivering">Entregar</button>
        <button class="kds-btn finished">Finalizar</button>
      </div>
    `;

    // Adiciona itens internamente
    const itensDiv = card.querySelector(".kds-itens");
    p.items.forEach(it => {
      const linha = document.createElement("div");
      linha.className = "kds-item";
      linha.innerHTML = `
        <span>${it.qty}x ${it.nameSnapshot}</span>
        <span>R$ ${(it.unitPrice * it.qty / 100).toFixed(2).replace('.', ',')}</span>
      `;
      itensDiv.appendChild(linha);
    });

    // Adiciona eventos aos botões
    card.querySelector(".ready").addEventListener("click", () => atualizarStatus(p.id, "preparing"));
    card.querySelector(".delivering").addEventListener("click", () => atualizarStatus(p.id, "delivering"));
    card.querySelector(".finished").addEventListener("click", () => atualizarStatus(p.id, "finished"));

    // Coloca o cartão no grid
    container.appendChild(card);
  });
}

// ----------- Atualiza o status de um pedido -----------

async function atualizarStatus(orderId, novoStatus) {
  try {
    // PUT ou PATCH de atualização do status (ajuste endpoint se necessário)
    const res = await fetch(`${apiBase}/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus })
    });

    if (!res.ok) {
      console.error("Falha ao atualizar status");
      return;
    }

    // Atualiza visualmente o status local
    const card = document.getElementById(`pedido-${orderId}`);
    if (card) card.querySelector(".kds-status").textContent = novoStatus;
  } catch (err) {
    console.error("Erro ao atualizar status:", err);
  }
}

// ----------- Conexão SSE para novos pedidos -----------

function iniciarStreamDaLoja() {
  // Altere storeId conforme necessário (poderia vir da sessão admin)
  const storeId = 1;
  const sse = new EventSource(`${apiBase}/store/${storeId}/stream`);

  // Evento recebido do backend quando novo pedido é criado
  sse.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Atualização recebida:", data);

      // Caso seja um novo pedido, recarrega lista
      if (data.kind === "order_created") {
        carregarPedidos();
      }
    } catch (err) {
      console.error("Erro tratando SSE:", err);
    }
  };

  sse.onerror = (err) => {
    console.warn("Erro no canal SSE:", err);
    sse.close();
  };
}

// ----------- Inicializa tudo quando a página carrega -----------

initKDS();