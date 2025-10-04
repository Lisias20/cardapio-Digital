let MENU = null;
let CART = { items: [], type: 'pickup', couponCode: '' };

function loadCart() {
  const slug = getStoreSlug();
  try {
    const raw = localStorage.getItem(`cart:${slug}`);
    if (raw) CART = JSON.parse(raw);
    if (!CART.items) CART.items = [];
  } catch(e) {}
}
function saveCart() {
  const slug = getStoreSlug();
  try { localStorage.setItem(`cart:${slug}`, JSON.stringify(CART)); } catch(e) {}
  renderCart();
}

async function fetchMenu() {
  const slug = getStoreSlug();
  const res = await fetch(`/${slug}/menu`);
  if (!res.ok) throw new Error('Falha ao carregar menu');
  return res.json();
}

function renderTheme(store) {
  document.documentElement.style.setProperty('--color-primary', store.themePrimary || '#D32F2F');
  qs('#storeName').textContent = store.name;
  if (store.logoUrl) qs('#logo').src = store.logoUrl;
  const tId = getTableContext();
  if (tId) {
    const tag = qs('#tableTag');
    tag.style.display = 'inline-block';
    tag.textContent = `Mesa ${tId}`;
    CART.type = 'dine_in';
  }
}

function renderCategories(cats) {
  const c = qs('#categories');
  c.innerHTML = cats.map(cat => `<h2 id="cat-${cat.id}">${cat.name}</h2>`).join('');
}

function renderProducts(products, optionGroups) {
  const cont = qs('#products');
  const search = qs('#search').value.trim().toLowerCase();
  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search) || (p.description||'').toLowerCase().includes(search));
  cont.innerHTML = filtered.map(p => {
    return `
      <div class="card">
        <img src="${p.imageUrl || '/public/img/placeholder.png'}" alt="${p.name}" />
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div>
              <div style="font-weight:700">${p.name}</div>
              <div class="badge">${fmtBRL(p.price)}</div>
            </div>
            <button class="btn" onclick="openAdd(${p.id})">Adicionar</button>
          </div>
          <div style="color:#666;margin-top:6px">${p.description || ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderCart() {
  const q = CART.items.reduce((a, it) => a + it.qty, 0);
  const total = CART.items.reduce((a, it) => a + it.qty * it.unitPrice + (it.options||[]).reduce((x,o)=>x+o.price,0)*it.qty, 0);
  qs('#cartSummary').textContent = q > 0 ? `${q} item(ns) - ${fmtBRL(total)}` : 'Seu carrinho está vazio';
  const slug = getStoreSlug();
  qs('#checkoutBtn').href = `/${slug}/checkout`;
}

function openAdd(productId) {
  const p = MENU.products.find(x => x.id === productId);
  const opts = MENU.optionGroups; // MVP: mostra todos os grupos; em produção, associar por produto
  const qty = 1;
  const selected = [];
  const name = prompt(`Adicionar "${p.name}"\nDigite observações (opcional):`) || '';
  // MVP: sem observações. Opções mínimas via confirm simples
  if (opts.length) {
    opts.forEach(g => {
      g.options.forEach(o => {
        const yes = confirm(`Adicionar opção: ${g.name} - ${o.name} (+${fmtBRL(o.price)})?`);
        if (yes) selected.push({ optionId: o.id, nameSnapshot: o.name, price: o.price });
      });
    });
  }
  CART.items.push({
    productId: p.id,
    nameSnapshot: p.name,
    unitPrice: p.price,
    qty,
    options: selected
  });
  saveCart();
}

(async function init() {
  loadCart();
  MENU = await fetchMenu();
  renderTheme(MENU.store);
  renderCategories(MENU.categories);
  renderProducts(MENU.products, MENU.optionGroups);
  renderCart();
  qs('#search').addEventListener('input', () => renderProducts(MENU.products, MENU.optionGroups));
})();