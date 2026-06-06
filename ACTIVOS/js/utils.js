function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function productText(product) {
  return [
    product?.name,
    product?.type,
    product?.meta,
    product?.varietal,
    product?.specs?.quantity
  ].filter(Boolean).join(' ').toLowerCase();
}

function isPresentationProduct(product) {
  const text = productText(product);
  return text.includes('bag in box') || /\bbib\b/.test(text) || text.includes('damajuana');
}

function isTetraProduct(product) {
  const text = productText(product);
  return /tetra\s*(?:brik|brick)?|tetrabrik|tetra brik/.test(text);
}

function getPackSize(priceEl) {
  const value = Number(priceEl?.dataset.packSize || 6);
  return Number.isFinite(value) && value > 0 ? value : 6;
}

function productPackSize(product, priceEl) {
  if(isTetraProduct(product)) return 12;
  return getPackSize(priceEl);
}

function purchaseModeForProduct(product) {
  return isPresentationProduct(product) ? 'presentation' : 'box';
}

function purchaseModeLabel(mode, packSize = 6) {
  if(mode === 'presentation') return 'presentacion';
  return `caja x${packSize}`;
}

function isSingleUnitPurchase(product) {
  return false;
}

function unitLabel(product) {
  if(product?.purchaseMode === 'presentation' || isPresentationProduct(product)) return 'presentacion';
  return `caja x${product?.packSize || 6}`;
}

function unitLabelPlural(product) {
  if(product?.purchaseMode === 'presentation' || isPresentationProduct(product)) return 'presentaciones';
  return `cajas x${product?.packSize || 6}`;
}

function quantityLabel(item) {
  return item.qty === 1 ? unitLabel(item) : unitLabelPlural(item);
}

function formatPrice(value) {
  if(!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS' }).format(value);
}
