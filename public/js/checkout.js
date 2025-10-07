// === checkout.js ===

// Slug da loja (ajuste conforme o backend)
const storeSlug = "pediu-chegou";
// Base da API local (use o endereço real do backend)
const apiBase = "http://localhost:3000/api";

// ---------- Funções utilitárias do carrinho ----------

// Lê o carrinho salvo no localStorage
function getCarrinho() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

// Salva o carrinho
function setCarrinho(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

// Limpa o carrinho (usado após fazer o pedido)
function limparCarrinho() {
  localStorage.removeItem("cart");
}

// ---------- Renderiza itens e totais ----------

// Exibe lista de produtos no HTML
function renderizarCarrinho() {
  const container = document.getElementById("cart-items");
  const items = getCarrinho();

  // Se não houver itens, mostra mensagem e para aqui
  if (items.length === 0) {
    container.innerHTML = "<p>Seu carrinho está vazio 😢</p>";
    document.getElementById("checkout-summary").innerHTML = "";
    return;
  }

  // Gera HTML com cada item
  container.innerHTML = items.map(item => `
    <div class="pc-product">
      <div class="pc-product-info">
        <p class="pc-product-name">${item.name}</p>
        <p class="pc-product-price">R$ ${(item.price/100).toFixed(2).replace('.', ',')}</p>
      </div>
      <div>
        <button class="pc-add-btn" onclick="alterarQtd(${item.productId}, -1)">−</button>
        <span style="margin:0 8px;">${item.qty}</span>
        <button class="pc-add-btn" onclick="alterarQtd(${item.productId}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

// Altera a quantidade (aumenta/diminui)
function alterarQtd(productId, delta) {
  const cart = getCarrinho();
  const item = cart.find(i => i.productId === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    // remove item se quantidade zero
    const idx = cart.findIndex(i => i.productId === productId);
    cart.splice(idx, 1);
  }
  setCarrinho(cart);
  renderizarCarrinho();
  calcularTotais();
}

// ---------- Cálculo de totais via API ----------

async function calcularTotais() {
  const cart = getCarrinho();
  if (cart.length === 0) return;

  // Monta corpo da requisição para rota /checkout/quote
  const body = {
    type: document.getElementById("type").value,
    items: cart.map(i => ({
      productId: i.productId,
      qty: i.qty,
      options: []
    })),
    coupon: document.getElementById("coupon").value || ""
  };

  try {
    const res = await fetch(`${apiBase}/${storeSlug}/checkout/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
      exibirTotais(data);
    } else {
      alert("Erro: " + (data.message || "não foi possível calcular os totais"));
    }
  } catch (err) {
    console.error("Falha ao calcular totais:", err);
  }
}

// Exibe totais retornados pela API
function exibirTotais(tot) {
  const el = document.getElementById("checkout-summary");
  el.innerHTML = `
    <h3>Resumo</h3>
    <p>Subtotal: R$ ${(tot.subtotal/100).toFixed(2).replace('.', ',')}</p>
    <p>Taxa: R$ ${((tot.packagingFee + tot.deliveryFee)/100).toFixed(2).replace('.', ',')}</p>
    <p>Desconto: R$ ${(tot.discount/100).toFixed(2).replace('.', ',')}</p>
    <hr>
    <h2>Total: R$ ${(tot.total/100).toFixed(2).replace('.', ',')}</h2>
  `;
}

// ---------- Envia o pedido ----------

document.getElementById("checkout-form").addEventListener("submit", async (e) => {
  e.preventDefault(); // evita recarregar página

  const cart = getCarrinho();
  if (cart.length === 0) {
    alert("Seu carrinho está vazio!");
    return;
  }

  // Captura campos do formulário
  const tipo = document.getElementById("type").value;
  const body = {
    type: tipo,
    items: cart.map(i => ({
      productId: i.productId,
      qty: i.qty,
      options: []
    })),
    customerName: document.getElementById("customer-name").value || "",
    customerPhone: document.getElementById("customer-phone").value || "",
    addressJson: tipo === "delivery" ? { address: document.getElementById("customer-address").value } : null,
    coupon: document.getElementById("coupon").value || ""
  };

  try {
    const res = await fetch(`${apiBase}/${storeSlug}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
      limparCarrinho(); // zera carrinho no localStorage
      // Redireciona para página de acompanhamento
      window.location.href = `order.html?id=${data.orderId}`;
    } else {
      alert("Erro ao criar pedido: " + data.message);
    }
  } catch (err) {
    console.error("Erro de rede:", err);
  }
});

// ---------- Comportamento dinâmico de campos ----------

// Mostra/oculta campos de delivery conforme tipo selecionado
document.getElementById("type").addEventListener("change", () => {
  const tipo = document.getElementById("type").value;
  const blocoDelivery = document.getElementById("delivery-fields");
  if (tipo === "delivery") blocoDelivery.style.display = "block";
  else blocoDelivery.style.display = "none";
  calcularTotais(); // recalcula porque a taxa pode mudar
});

// ---------- Inicialização ----------
renderizarCarrinho();
calcularTotais();