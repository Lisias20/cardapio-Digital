async function fetchJSON(url, opts) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getSlug() {
  const [ , slug ] = window.location.pathname.split('/');
  return slug;
}

function getTableContext() {
  // suporta /:slug/m/:tableId?t=...
  const parts = window.location.pathname.split('/');
  const mIdx = parts.indexOf('m');
  if (mIdx > -1) {
    const tableId = parts[mIdx+1];
    const t = new URLSearchParams(window.location.search).get('t');
    localStorage.setItem('tableId', tableId);
    localStorage.setItem('tableNonce', t || '');
  }
  return localStorage.getItem('tableId') || null;
}

function themeStore(store) {
  document.documentElement.style.setProperty('--primary', store.themePrimary || '#e11d48');
}

function loadCart() {
  try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(item) {
  const cart = loadCart();
  cart.push(item);
  saveCart(cart);
  alert('Adicionado ao carrinho!');
}

async function renderMenu() {
  const slug = getSlug();
  getTableContext();
  const data = await fetchJSON(`/${slug}/menu`);
  themeStore(data.store);
  document.getElementById('storeName').textContent = data.store.name;
  document.getElementById('badgeSlug').textContent = data.store.slug;
  document.getElementById('storeLogo').src = data.store.logoUrl || 'https://via.placeholder.com/80?text=Logo';
  document.getElementById('storeSlugFooter').textContent = data.store.slug;

  const categories = data.categories.sort((a,b)=>a.position-b.position);
  const products = data.products;

  const container = document.getElementById('menu');
  container.innerHTML = '';

  categories.forEach(cat => {
    const section = document.createElement('section');
    section.innerHTML = `<h2 class="section-title">${cat.name}</h2>`;
    const grid = document.createElement('div'); grid.className = 'grid';
    products.filter(p => p.categoryId === cat.id && p.active).forEach(p => {
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `
        <div style="display:flex; gap:10px;">
          <img src="${p.imageUrl || 'https://via.placeholder.com/120'}" style="width:120px;height:90px;object-fit:cover;border-radius:8px" alt="${p.name}">
          <div>
            <div style="font-weight:600">${p.name}</div>
            <div style="font-size:14px;color:#475569">${p.description || ''}</div>
            <div style="margin-top:6px;font-weight:700">R$ ${(p.price/100).toFixed(2).replace('.',',')}</div>
          </div>
        </div>
        <div class="space"></div>
        <button class="btn" data-id="${p.id}">Adicionar</button>
      `;
      card.querySelector('button').addEventListener('click', () => {
        addToCart({ productId: p.id, qty: 1, options: [] });
      });
      grid.appendChild(card);
    });
    section.appendChild(grid);
    container.appendChild(section);
  });

  document.getElementById('checkoutBtn').onclick = () => {
    window.location.href = `/${slug}/checkout`;
  };
}

renderMenu().catch(err => {
  console.error(err);
  alert('Erro ao carregar menu');
});