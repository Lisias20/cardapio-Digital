// === menu.js ===

// 1️⃣ Define base da API
const apiBase = "http://localhost:3000/api";

/*
  2️⃣ Este módulo carrega categorias, mostra produtos e permite adicionar produtos novos.
*/

// ---------- Busca e renderiza o cardápio atual ----------

async function carregarMenu() {
  try {
    const res = await fetch(`${apiBase}/admin/menu`);
    const data = await res.json();

    if (!res.ok) {
      console.error("Erro ao buscar menu");
      return;
    }

    renderizarMenu(data.categories, data.products);
    preencherSelectCategorias(data.categories);
  } catch (err) {
    console.error("Erro de rede:", err);
  }
}

// ---------- Mostra categorias + produtos ----------

function renderizarMenu(categorias, produtos) {
  const cont = document.getElementById("menu-list");
  cont.innerHTML = "";

  // Loop pelas categorias
  categorias.forEach((cat) => {
    const div = document.createElement("div");
    div.className = "menu-cat";
    div.innerHTML = `<h3>${cat.name}</h3>`;

    // Filtra produtos da categoria
    const prodsCat = produtos.filter((p) => p.categoryId === cat.id);
    if (prodsCat.length === 0) {
      div.innerHTML += "<p>Sem produtos.</p>";
    } else {
      prodsCat.forEach((p) => {
        const linha = document.createElement("div");
        linha.className = "menu-prod-item";
        linha.innerHTML = `
          <span>${p.name}</span>
          <span>R$ ${(p.price/100).toFixed(2).replace('.', ',')}</span>
        `;
        div.appendChild(linha);
      });
    }

    cont.appendChild(div);
  });
}

// ---------- Preenche <select> com categorias ----------

function preencherSelectCategorias(categorias) {
  const sel = document.getElementById("cat-prod");
  sel.innerHTML = categorias
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");
}

// ---------- Adiciona Produto ----------

document.getElementById("btn-add").addEventListener("click", async () => {
  const nome = document.getElementById("nome-prod").value.trim();
  const preco = Number(document.getElementById("preco-prod").value);
  const cat = Number(document.getElementById("cat-prod").value);

  if (!nome || !preco || !cat) {
    alert("Preencha todos os campos!");
    return;
  }

  // Corpo da requisição para criar produto
  const body = {
    name: nome,
    price: Math.round(preco * 100), // converte para centavos
    categoryId: cat,
    active: 1
  };

  try {
    const res = await fetch(`${apiBase}/admin/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      alert("Produto adicionado!");
      carregarMenu(); // atualiza lista
    } else {
      alert("Falha ao adicionar produto");
    }
  } catch (err) {
    console.error("Erro ao enviar produto:", err);
  }
});

// ---------- Inicia carregamento ----------
carregarMenu();