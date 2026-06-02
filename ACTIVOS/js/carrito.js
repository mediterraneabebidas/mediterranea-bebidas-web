let cart = [];

function isPromoPurchase(product) {
  return product?.purchaseMode === 'promo' || Boolean(product?.promoId);
}

function promoCartKey(product) {
  if(!isPromoPurchase(product)) return '';
  return [product.promoId || product.name, product.variantKey || product.meta || 'default'].join('::');
}

function cartItemKey(product) {
  if(isPromoPurchase(product)) return promoCartKey(product);
  return [product.name, product.meta, product.purchaseMode].join('::');
}

function cartUnitSummary() {
  const nonPromoItems = cart.filter(item => !isPromoPurchase(item));
  const hasPromos = cart.some(isPromoPurchase);
  const hasUnits = nonPromoItems.some(isSingleUnitPurchase);
  const boxItems = nonPromoItems.filter(item => !isSingleUnitPurchase(item));
  const hasBoxes = boxItems.length > 0;
  if(hasPromos && !hasUnits && !hasBoxes) return 'promos 3+1';
  if(hasPromos) return 'pedido';
  if(hasUnits && hasBoxes) return 'pedido';
  if(hasUnits) return 'unidades';
  const packSizes = [...new Set(boxItems.map(item => item.packSize || 6))];
  return packSizes.length === 1 ? `cajas x${packSizes[0]}` : 'cajas';
}

function cartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (Number.isFinite(item.price) ? item.price * item.qty : 0), 0);
  const missing = cart.some(item => !Number.isFinite(item.price));
  return { subtotal, missing };
}

function promoQuantityLabel(item) {
  return item.qty === 1 ? 'promo 3+1' : 'promos 3+1';
}

function renderPriceLine(item) {
  if(isPromoPurchase(item)) {
    if(!Number.isFinite(item.price)) return '<div class="cart-item-price">Precio promo a confirmar</div>';
    return `<div class="cart-item-price">${formatPrice(item.price)} por promo completa</div>`;
  }
  if(!Number.isFinite(item.price)) return `<div class="cart-item-price">Precio a confirmar por ${unitLabel(item)}</div>`;
  return `<div class="cart-item-price">${formatPrice(item.price)} por ${unitLabel(item)}</div>`;
}

function renderCheckoutPriceLine(item) {
  if(isPromoPurchase(item)) {
    if(!Number.isFinite(item.price)) return '<div class="checkout-summary-price">Precio promo a confirmar</div>';
    return `<div class="checkout-summary-price">${formatPrice(item.price * item.qty)} &middot; ${item.qty} ${promoQuantityLabel(item)}</div>`;
  }
  if(!Number.isFinite(item.price)) return `<div class="checkout-summary-price">Precio a confirmar por ${unitLabel(item)}</div>`;
  return `<div class="checkout-summary-price">${formatPrice(item.price * item.qty)} &middot; ${item.qty} ${quantityLabel(item)}</div>`;
}

function renderCartMeta(item) {
  if(isPromoPurchase(item)) {
    const detail = item.promoDetail || item.meta || '3 cajas + 1 de regalo';
    return `
      <div class="cart-item-meta promo-cart-meta">
        <span class="promo-cart-pill">Promo</span>
        <span>${escapeHtml(detail)}</span>
        <span class="promo-cart-gift">3 cajas + 1 de regalo</span>
      </div>
    `;
  }
  return `<div class="cart-item-meta">${item.type}${item.specs ? renderMiniSpecs(item.specs) : (item.meta ? ' &middot; ' + item.meta : '')}</div>`;
}

function addToCart(product) {
  const key = cartItemKey(product);
  const existing = cart.find(item => cartItemKey(item) === key);
  if(existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  renderCart();
  openCart();
}

function changeQty(index, delta) {
  if(!cart[index]) return;
  cart[index].qty += delta;
  if(cart[index].qty <= 0) cart.splice(index, 1);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function openCart() {
  document.getElementById('cartDrawer')?.classList.add('open');
  document.getElementById('cartOverlay')?.classList.add('open');
}

function closeCart() {
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('cartOverlay')?.classList.remove('open');
}

function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const countEl = document.getElementById('cartCount');
  if(countEl) countEl.textContent = count;
  const list = document.getElementById('cartList');
  if(!list) return;
  if(!cart.length) {
    list.innerHTML = '<div class="cart-empty">Todavia no agregaste productos. Elegi vinos del catalogo y arma tu pedido.</div>';
    renderCheckoutSummary();
    return;
  }
  list.innerHTML = cart.map((item, index) => `
    <div class="cart-item${isPromoPurchase(item) ? ' promo-cart-item' : ''}">
      ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<div></div>'}
      <div>
        <div class="cart-item-name">${item.name}</div>
        ${renderCartMeta(item)}${renderPriceLine(item)}
      </div>
      <div class="qty-control">
        <button type="button" onclick="changeQty(${index}, -1)">-</button>
        <span>${item.qty}</span>
        <button type="button" onclick="changeQty(${index}, 1)">+</button>
      </div>
    </div>
  `).join('');
  renderCheckoutSummary();
}

function cartMessage() {
  if(!cart.length) return 'Hola Mediterranea Bebidas, quiero hacer una consulta.';
  const lines = cart.map(item => `- ${orderLine(item)}`);
  return ['Hola Mediterranea Bebidas, quiero hacer este pedido:', ...lines, '', orderTotalLine(), 'Total sujeto a confirmacion de stock, envio e impuestos.'].join('\n');
}

function sendCartToWhatsApp() {
  window.location.href = whatsAppUrl(cartMessage());
}
