function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function isUnitProduct(product) {
  const type = String(product?.type || '').toLowerCase();
  return type.includes('bag in box') || type.includes('damajuana');
}

function getPackSize(priceEl) {
  const value = Number(priceEl?.dataset.packSize || 6);
  return Number.isFinite(value) && value > 0 ? value : 6;
}

function purchaseModeLabel(mode, packSize = 6) {
  return mode === 'unit' ? 'unidad' : `caja x${packSize}`;
}

function isSingleUnitPurchase(product) {
  return isUnitProduct(product) || product?.purchaseMode === 'unit';
}

function unitLabel(product) {
  return isSingleUnitPurchase(product) ? 'unidad' : `caja x${product?.packSize || 6}`;
}

function unitLabelPlural(product) {
  return isSingleUnitPurchase(product) ? 'unidades' : `cajas x${product?.packSize || 6}`;
}

function quantityLabel(item) {
  return item.qty === 1 ? unitLabel(item) : unitLabelPlural(item);
}

function unitPriceFromBox(boxPrice, packSize = 6) {
  return Number.isFinite(boxPrice) ? boxPrice / packSize : null;
}

function formatPrice(value) {
  if(!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' }).format(value);
}
