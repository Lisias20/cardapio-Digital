// === login.js ===

// 1️⃣ Endereço da API admin
const apiBase = "http://localhost:3000/api";

// 2️⃣ Escuta o submit do formulário
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault(); // impede recarregar a página

  // 3️⃣ Captura email e senha
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  // 4️⃣ Corpo JSON a ser enviado
  const body = { email, password };

  try {
    // 5️⃣ Faz POST /admin/login (ajuste conforme backend)
    const res = await fetch(`${apiBase}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (res.ok) {
      // 6️⃣ Guarda o token de acesso para usar nas próximas rotas admin
      localStorage.setItem("token", data.token);

      // 7️⃣ Redireciona para o dashboard
      window.location.href = "./dashboard.html";
    } else {
      document.getElementById("login-msg").textContent =
        data.message || "Usuário ou senha incorretos";
    }
  } catch (err) {
    console.error("Erro de rede:", err);
    document.getElementById("login-msg").textContent =
      "Falha na conexão com o servidor";
  }
});