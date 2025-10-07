// === order.js ===

// Slug base e endpoint da API
const apiBase = "http://localhost:3000/api";

// --------- 1️⃣ Funções utilitárias ---------

// Função para obter o parâmetro "id" da URL (ex: order.html?id=ord_abcd123)
function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

// Converte valor em centavos para formato BRL legível
function formatarPreco(cents) {
  return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

// --------- 2️⃣ Buscar e mostrar pedido inicial ---------

async function carregarPedido() {
  // Busca o ID do pedido na query string
  const orderId = getParam("id");
  if (!orderId) {
    document.getElementById("order-status").textContent = "Pedido não encontrado.";
    return;
  }

  // Atualiza o título com o número do pedido
  document.getElementById("order-title").textContent = `Pedido ${orderId}`;

  try {
    // Requisição GET /orders/:id no backend
    const res = await fetch(`${apiBase}/orders/${orderId}`);
    const data = await res.json();

    if (!res.ok) {
      document.getElementById("order-status").textContent =
        "Erro ao carregar pedido: " + (data.message || "desconhecido");
      return;
    }

    // Renderiza cada parte do pedido
    exibirStatus(data.status, data.paymentStatus);
    exibirItens(data.items);
    exibirResumo(data);
    atualizarUltimaAtualizacao(data.updatedAt);

    // Depois que renderiza, inicia conexão SSE pra atualizações em tempo real
    iniciarStream(orderId);
  } catch (err) {
    console.error("Erro de rede:", err);
    document.getElementById("order-status").textContent =
      "Não foi possível carregar o pedido.";
  }
}

// --------- 3️⃣ Exibir status visualmente ---------

function exibirStatus(status, paymentStatus) {
  const el = document.getElementById("order-status");
  let texto = "";

  // Mapeia status de backend para uma descrição amigável
  const mapa = {
    received: "Recebido 🧾",
    preparing: "Em preparo 👨‍🍳",
    ready: "Pronto para retirada 🍱",
    delivering: "A caminho 🛵",
    finished: "Concluído ✅",
    canceled: "Cancelado ❌"
  };

  texto = mapa[status] || status;

  // Adiciona info do pagamento
  const pay = paymentStatus === "paid" ? " — Pago 💰" : " — Aguardando pagamento";
  el.textContent = texto + pay;
}

// --------- 4️⃣ Exibir itens ---------

function exibirItens(itens) {
  const cont = document.getElementById("order-items");

  // Se não houver itens, mostra aviso
  if (!itens || itens.length === 0) {
    cont.innerHTML = "<p>Nenhum item encontrado.</p>";
    return;
  }

  // Cria linhas com nome, qtd e preço total
  cont.innerHTML = itens
    .map(
      (it) => `
    <div class="pc-product">
      <div class="pc-product-info">
        <p class="pc-product-name">${it.nameSnapshot}</p>
        <p>${it.qty} × ${formatarPreco(it.unitPrice)}</p>
      </div>
      <span>${formatarPreco(it.unitPrice * it.qty)}</span>
    </div>
  `
    )
    .join("");
}

// --------- 5️⃣ Exibir resumo de valores ---------

function exibirResumo(pedido) {
  const el = document.getElementById("order-summary");

  el.innerHTML = `
    <h3>Resumo</h3>
    <p>Subtotal: ${formatarPreco(pedido.subtotal)}</p>
    <p>Taxa de entrega: ${formatarPreco(pedido.deliveryFee)}</p>
    <p>Taxa de embalagem: ${formatarPreco(pedido.packagingFee)}</p>
    <p>Desconto: ${formatarPreco(pedido.discount)}</p>
    <hr>
    <h2>Total: ${formatarPreco(pedido.total)}</h2>
  `;
}

// --------- 6️⃣ Atualizar data/hora de última modificação ---------

function atualizarUltimaAtualizacao(isoString) {
  if (!isoString) return;
  const data = new Date(isoString);
  const formatado = data.toLocaleString("pt-BR");
  document.getElementById("order-updated").textContent =
    `Última atualização: ${formatado}`;
}

// --------- 7️⃣ Conexão SSE (tempo real) ---------

function iniciarStream(orderId) {
  try {
    // Cria nova conexão de eventos
    const sse = new EventSource(`${apiBase}/orders/${orderId}/stream`);

    // Quando o servidor enviar uma atualização
    sse.onmessage = (event) => {
      try {
        // Decodifica o objeto recebido
        const data = JSON.parse(event.data);

        // Atualiza status e data
        exibirStatus(data.status, data.paymentStatus);
        atualizarUltimaAtualizacao(data.updatedAt);
      } catch (parseErr) {
        console.error("Erro interpretando SSE:", parseErr);
      }
    };

    // Tratamento de erro
    sse.onerror = (err) => {
      console.warn("Conexão SSE encerrada ou com erro:", err);
      sse.close();
    };
  } catch (err) {
    console.error("Erro ao iniciar SSE:", err);
  }
}

// --------- 8️⃣ Inicialização da tela ---------

// Assim que a página carrega, executa a função para buscar o pedido
carregarPedido();

// === orders.js ===

// 1️⃣ Configuração inicial
const apiBase = "http://localhost:3000/api";

/*
  2️⃣ Função: Carrega lista de pedidos conforme filtro de status.
  Usa rotas admin (ajuste conforme backend).
*/

// ---------- Busca lista e renderiza ----------

async function carregarPedidos() {
  const filtro = document.getElementById("status").value;
  let url = `${apiBase}/admin/orders`;
  if (filtro) url += `?status=${filtro}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      console.error("Falha ao buscar pedidos");
      return;
    }
    renderizarPedidos(data);
  } catch (err) {
    console.error("Erro de rede ao buscar pedidos:", err);
  }
}

// ---------- Renderiza a tabela ----------

function renderizarPedidos(pedidos) {
  const corpo = document.getElementById("orders-body");
  if (!pedidos || pedidos.length === 0) {
    corpo.innerHTML = `<tr><td colspan="6">Nenhum pedido encontrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = pedidos
    .map(
      (p) => `
      <tr>
        <td>${p.id}</td>
        <td>${p.type}</td>
        <td>${p.status}</td>
        <td>R$ ${(p.total / 100).toFixed(2).replace(".", ",")}</td>
        <td>${new Date(p.createdAt).toLocaleString("pt-BR")}</td>
        <td>
          <button onclick="alterarStatus('${p.id}', 'finished')">Finalizar</button>
          <button onclick="alterarStatus('${p.id}', 'canceled')">Cancelar</button>
        </td>
      </tr>`
    )
    .join("");
}

// ---------- Atualizar status ----------

async function alterarStatus(id, novo) {
  try {
    const res = await fetch(`${apiBase}/admin/orders/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    });
    if (res.ok) {
      carregarPedidos(); // recarrega tabela
    } else {
      alert("Falha ao atualizar status");
    }
  } catch (err) {
    console.error("Erro ao atualizar status:", err);
  }
}

// ---------- Filtro de status interativo ----------

document.getElementById("status").addEventListener("change", carregarPedidos);

// ---------- Inicialização ----------
carregarPedidos();