// Helpers comuns no front
function fmtBRL(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function qs(sel, el=document) { return el.querySelector(sel); }
function qsa(sel, el=document) { return [...el.querySelectorAll(sel)]; }
function getStoreSlug() { return location.pathname.split('/').filter(Boolean)[0]; }
function getTableContext() {
  const slug = getStoreSlug();
  try { return localStorage.getItem(`currentTableId:${slug}`); } catch(e) { return null; }
}