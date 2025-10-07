// === tables.js ===

// 1️⃣ Base da API
const apiBase = "http://localhost:3000/api";

// 2️⃣ Carrega e mostra as mesas atuais
async function carregarMesas() {
  try {
    // Requisição para rota admin de mesas
    const res = await fetch(`${apiBase}/admin/tables`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"), // autenticação
      },
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Erro carregando mesas");
      return;
    }

    renderizarMesas(data);
  } catch (err) {
    console.error("Erro de rede:", err);
  }
}

// 3️⃣ Renderiza visualmente as mesas
function renderizarMesas(list) {
  const cont = document.getElementById("tables-list");

  if (!list || list.length === 0) {
    cont.innerHTML = "<p>Nenhuma mesa cadastrada.</p>";
    return;
  }

  cont.innerHTML = list
    .map(
      (t) => `
      <div class="table-card">
        <span>${t.name}</span>
        <button onclick="deletarMesa(${t.id})">Remover</button>
      </div>`
    )
    .join("");
}

// 4️⃣ Cadastrar nova mesa
document.getElementById("btn-add-table").addEventListener("click", async () => {
  const name = document.getElementById("table-name").value.trim();
  if (!name) {
    alert("Informe o nome ou número da mesa!");
    return;
  }

  const body = { name };

  try {
    const res = await fetch(`${apiBase}/admin/tables`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      document.getElementById("table-name").value = "";
      carregarMesas(); // atualiza lista
    } else {
      alert("Falha ao criar mesa");
    }
  } catch (err) {
    console.error("Erro ao adicionar mesa:", err);
  }
});

// 5️⃣ Excluir mesa existente
async function deletarMesa(id) {
  if (!confirm("Remover esta mesa?")) return;

  try {
    const res = await fetch(`${apiBase}/admin/tables/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    if (res.ok) {
      carregarMesas();
    } else {
      alert("Falha ao remover mesa");
    }
  } catch (err) {
    console.error("Erro ao remover mesa:", err);
  }
}

// 6️⃣ Inicialização
carregarMesas();