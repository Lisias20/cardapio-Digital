// Calcula totais sempre no backend (centavos)
function calcTotals({ items, deliveryFee = 0, packagingFee = 0, coupon = null }) {
  const subtotal = items.reduce((acc, it) => {
    const itemTotal = (it.unitPrice || 0) * (it.qty || 1) + (it.options || []).reduce((a, op) => a + (op.price || 0), 0) * (it.qty || 1);
    return acc + itemTotal;
  }, 0);
  let discount = 0;
  if (coupon && coupon.type) {
    if (coupon.type === 'percentage') discount = Math.round(subtotal * (coupon.value / 100));
    if (coupon.type === 'fixed') discount = Math.min(subtotal, coupon.value);
  }
  const total = Math.max(0, subtotal - discount + deliveryFee + packagingFee);
  return { subtotal, deliveryFee, packagingFee, discount, total };
}

module.exports = { calcTotals };