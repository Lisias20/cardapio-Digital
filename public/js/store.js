// js/store.js

// Configuração: você pode ajustar o slug fixo enquanto testa.
const storeSlug = "pediu-chegou"; 
const apiBase = "http://localhost:3000/api"; // ajuste conforme backend

// Recupera menu da API
async function carregarCardapio() {
  try {
    const res = await fetch(`${apiBase}/${storeSlug}/menu`);
    const data = await res.json();
    renderizarCardapio(data.categories);
  } catch (err) {
    console.error("Erro ao carregar cardápio:", err);
  }
}

// Renderiza categorias e produtos
function renderizarCardapio(categorias) {
  const container = document.getElementById("menu-container");
  container.innerHTML = "";

  categorias.forEach(cat => {
    const catDiv = document.createElement("div");
    catDiv.className = "pc-category";
    catDiv.innerHTML = `<h2>${cat.name}</h2>`;
    
    const list = document.createElement("div");
    list.className = "pc-products";

    cat.products.forEach(prod => {
      const item = document.createElement("div");
      item.className = "pc-product";
      item.innerHTML = `
        <div class="pc-product-info">
          <p class="pc-product-name">${prod.name}</p>
          <p class="pc-product-price">R$ ${(prod.price/100).toFixed(2).replace('.', ',')}</p>
        </div>
        <button class="pc-add-btn" data-id="${prod.id}" data-name="${prod.name}" data-price="${prod.price}">
          +
        </button>`;
      list.appendChild(item);
    });

    catDiv.appendChild(list);
    container.appendChild(catDiv);
  });

  ativarBotoesAdd();
}

// Gerencia carrinho em localStorage
function getCarrinho() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}
function setCarrinho(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  atualizarCarrinhoUI();
}
function adicionarItem(produto) {
  const cart = getCarrinho();
  const existente = cart.find(i => i.productId === produto.productId);
  if (existente) existente.qty += 1;
  else cart.push(produto);
  setCarrinho(cart);
}

// Vincula eventos dos botões
function ativarBotoesAdd() {
  document.querySelectorAll(".pc-add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const produto = {
        productId: Number(btn.dataset.id),
        name: btn.dataset.name,
        price: Number(btn.dataset.price),
        qty: 1
      };
      adicionarItem(produto);
    });
  });
}

// Atualiza botão do carrinho
function atualizarCarrinhoUI() {
  const cart = getCarrinho();
  const totalItens = cart.reduce((acc, i) => acc + i.qty, 0);
  const totalValor = cart.reduce((acc, i) => acc + i.price * i.qty, 0);

  document.getElementById("cart-count").textContent = totalItens;

  const floating = document.getElementById("cart-floating");
  if (cart.length > 0) {
    floating.classList.add("show");
    document.getElementById("cart-total").textContent = 
      `R$ ${(totalValor/100).toFixed(2).replace('.', ',')}`;
  } else {
    floating.classList.remove("show");
  }
}

// Redireciona para checkout
document.getElementById("cart-floating").addEventListener("click", () => {
  window.location.href = "checkout.html";
});

carregarCardapio();
atualizarCarrinhoUI();