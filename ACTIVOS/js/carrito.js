let cart = [];

const CHACABUCO_PROMO_ID = 'chacabuco-3x1';
const CHACABUCO_PROMO_GIFT_DETAIL = '1 caja Chacabuco Cabernet Franc sin cargo';
const CHACABUCO_CHENIN_PROMO_ID = 'chacabuco-chenin';
const CHACABUCO_CHENIN_PRICE_CODE = '394';
const CHACABUCO_CHENIN_PRICE = 36887.20;
const CHACABUCO_CHENIN_IMAGE = 'PRODUCTOS/producto_029.png';
const CHACABUCO_CHENIN_ELIGIBLE_CODES = new Set(['399', '397', '393', '392']);
const CHACABUCO_PROMO_VARIANTS = {
  malbec: {
    label: 'Chacabuco Malbec',
    shortLabel: 'Malbec',
    image: 'PRODUCTOS/producto_025.png',
    variety: 'Malbec'
  },
  cabernet: {
    label: 'Chacabuco Cabernet',
    shortLabel: 'Cabernet',
    image: 'PRODUCTOS/producto_026.png',
    variety: 'Cabernet'
  },
  rosado: {
    label: 'Chacabuco Rosado',
    shortLabel: 'Rosado',
    image: 'PRODUCTOS/producto_028.png',
    variety: 'Rosado'
  }
};

function isPromoPurchase(product) {
  return product?.purchaseMode === 'promo' || Boolean(product?.promoId);
}

function isPromoAddon(product) {
  return product?.purchaseMode === 'promo-addon' || Boolean(product?.addonId);
}

function isChacabucoPromo(item) {
  return isPromoPurchase(item) && item?.promoId === CHACABUCO_PROMO_ID;
}

function isChacabucoCheninPromo(item) {
  return item?.purchaseMode === 'chenin-promo' || item?.cheninPromoId === CHACABUCO_CHENIN_PROMO_ID;
}

function isChacabucoCheninCandidate(item) {
  return String(item?.priceCode || '') === CHACABUCO_CHENIN_PRICE_CODE;
}

function isNormalChacabucoVarietalBox(item) {
  return !isPromoPurchase(item)
    && !isChacabucoCheninPromo(item)
    && item?.purchaseMode === 'box'
    && CHACABUCO_CHENIN_ELIGIBLE_CODES.has(String(item?.priceCode || ''));
}

function chacabucoCartVariant(key) {
  return CHACABUCO_PROMO_VARIANTS[key] || CHACABUCO_PROMO_VARIANTS.malbec;
}

function chacabucoPromoMetaForVariant(key) {
  const variant = chacabucoCartVariant(key);
  return `3 cajas ${variant.label} + ${CHACABUCO_PROMO_GIFT_DETAIL}`;
}

function chacabucoPromoSpecsForVariant(key) {
  const variant = chacabucoCartVariant(key);
  return {
    variety: `${variant.variety} + Cabernet Franc bonificado`,
    provenance: 'Mendoza',
    quantity: '4 cajas x6 (3 pagas + 1 Cabernet Franc sin cargo)'
  };
}

function applyChacabucoPromoVariant(item, variantKey) {
  const normalizedKey = CHACABUCO_PROMO_VARIANTS[variantKey] ? variantKey : 'malbec';
  const variant = chacabucoCartVariant(normalizedKey);
  item.variantKey = normalizedKey;
  item.meta = chacabucoPromoMetaForVariant(normalizedKey);
  item.specs = chacabucoPromoSpecsForVariant(normalizedKey);
  item.image = variant.image;
  item.priceCode = CHACABUCO_PROMO_ID;
  item.purchaseMode = 'promo';
  item.purchaseLabel = 'promo 3+1';
  return item;
}

function promoCartKey(product) {
  if(!isPromoPurchase(product)) return '';
  return [product.promoId || product.name, product.variantKey || product.meta || 'default'].join('::');
}

function cartItemKey(product) {
  if(isChacabucoCheninPromo(product)) return [product.cheninPromoId || product.name, product.purchaseMode].join('::');
  if(isPromoPurchase(product)) return promoCartKey(product);
  if(isPromoAddon(product)) return [product.addonId || product.name, product.purchaseMode].join('::');
  return [product.name, product.meta, product.purchaseMode].join('::');
}

function cartUnitSummary() {
  const nonPromoItems = cart.filter(item => !isPromoPurchase(item));
  const hasPromos = cart.some(isPromoPurchase);
  const presentationItems = nonPromoItems.filter(item => item.purchaseMode === 'presentation' || isPresentationProduct(item));
  const boxItems = nonPromoItems.filter(item => !presentationItems.includes(item));
  const hasBoxes = boxItems.length > 0;
  const hasPresentations = presentationItems.length > 0;
  if(hasPromos && !hasBoxes && !hasPresentations) return 'promos 3+1';
  if(hasPromos) return 'pedido';
  if(hasPresentations && hasBoxes) return 'pedido';
  if(hasPresentations) return 'presentaciones';
  const packSizes = [...new Set(boxItems.map(item => item.packSize || 6))];
  return packSizes.length === 1 ? `cajas x${packSizes[0]}` : 'cajas';
}

function chacabucoPromoQtyTotal() {
  return cart.reduce((sum, item) => sum + (isChacabucoPromo(item) ? item.qty : 0), 0);
}

function chacabucoNormalVarietalQtyTotal() {
  return cart.reduce((sum, item) => sum + (isNormalChacabucoVarietalBox(item) ? item.qty : 0), 0);
}

function maxCheninPromoQty() {
  return chacabucoNormalVarietalQtyTotal();
}

function cheninPromoQty() {
  return cart.reduce((sum, item) => sum + (isChacabucoCheninPromo(item) ? item.qty : 0), 0);
}

function canAddCheninPromo() {
  return maxCheninPromoQty() > cheninPromoQty();
}

function cheninPromoProduct() {
  return {
    cheninPromoId: CHACABUCO_CHENIN_PROMO_ID,
    name: 'Chacabuco Chenin Dulce',
    meta: 'Comprando Chacabuco varietal lleva al mismo precio Chacabuco Chenin Dulce',
    specs: {
      variety: 'Chenin Dulce',
      provenance: 'Mendoza',
      quantity: 'Caja x6'
    },
    type: 'Chacabuco + Chenin',
    image: CHACABUCO_CHENIN_IMAGE,
    price: CHACABUCO_CHENIN_PRICE,
    basePrice: CHACABUCO_CHENIN_PRICE,
    packSize: 6,
    purchaseMode: 'chenin-promo',
    purchaseLabel: 'promo Chenin',
    priceLabel: typeof window !== 'undefined' && typeof window.formatPrice === 'function' ? window.formatPrice(CHACABUCO_CHENIN_PRICE) : '$36.887,20',
    priceCode: CHACABUCO_CHENIN_PRICE_CODE
  };
}

function syncCheninPromoLimit() {
  const maxQty = maxCheninPromoQty();
  const cheninItems = cart.filter(isChacabucoCheninPromo);
  if(!cheninItems.length) return;

  const totalQty = cheninItems.reduce((sum, item) => sum + item.qty, 0);
  cart = cart.filter(item => !isChacabucoCheninPromo(item));
  if(maxQty <= 0) return;

  cart.push({ ...cheninPromoProduct(), qty: Math.min(totalQty, maxQty) });
}

function setCheninPromoQty(qty) {
  const maxQty = maxCheninPromoQty();
  const nextQty = Math.max(0, Math.min(qty, maxQty));
  cart = cart.filter(item => !isChacabucoCheninPromo(item));
  if(nextQty > 0) cart.push({ ...cheninPromoProduct(), qty: nextQty });
  renderCart();
}

function addCheninPromo() {
  if(maxCheninPromoQty() <= 0) return;
  setCheninPromoQty(cheninPromoQty() + 1);
}

function changeCheninPromoQty(delta) {
  setCheninPromoQty(cheninPromoQty() + delta);
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
  if(isChacabucoCheninPromo(item)) {
    return `<div class="cart-item-price">${formatPrice(item.price)} por caja x6 &middot; promo Chenin</div>`;
  }
  if(!Number.isFinite(item.price)) return `<div class="cart-item-price">Precio a confirmar por ${unitLabel(item)}</div>`;
  return `<div class="cart-item-price">${formatPrice(item.price)} por ${unitLabel(item)}</div>`;
}

function renderCheckoutPriceLine(item) {
  if(isPromoPurchase(item)) {
    if(!Number.isFinite(item.price)) return '<div class="checkout-summary-price">Precio promo a confirmar</div>';
    return `<div class="checkout-summary-price">${formatPrice(item.price * item.qty)} &middot; ${item.qty} ${promoQuantityLabel(item)}</div>`;
  }
  if(isChacabucoCheninPromo(item)) {
    return `<div class="checkout-summary-price">${formatPrice(item.price * item.qty)} &middot; ${item.qty} cajas x6 Chenin</div>`;
  }
  if(!Number.isFinite(item.price)) return `<div class="checkout-summary-price">Precio a confirmar por ${unitLabel(item)}</div>`;
  return `<div class="checkout-summary-price">${formatPrice(item.price * item.qty)} &middot; ${item.qty} ${quantityLabel(item)}</div>`;
}

function renderPromoVariantSelector(item, index) {
  if(!isChacabucoPromo(item)) return '';
  const activeKey = CHACABUCO_PROMO_VARIANTS[item.variantKey] ? item.variantKey : 'malbec';
  const buttons = Object.entries(CHACABUCO_PROMO_VARIANTS).map(([key, variant]) => `
    <button
      class="promo-cart-variant${key === activeKey ? ' active' : ''}"
      type="button"
      aria-pressed="${key === activeKey ? 'true' : 'false'}"
      onclick="changePromoVariant(${index}, '${escapeHtml(key)}')"
    >${escapeHtml(variant.shortLabel)}</button>
  `).join('');
  return `<div class="promo-cart-variants" role="group" aria-label="Cambiar varietal de la promo Chacabuco">${buttons}</div>`;
}

function renderCartMeta(item, index) {
  if(isPromoPurchase(item)) {
    const detail = item.promoDetail || item.meta || '3 cajas + 1 de regalo';
    return `
      <div class="cart-item-meta promo-cart-meta">
        <span class="promo-cart-pill">Promo</span>
        <span>${escapeHtml(detail)}</span>
        <span class="promo-cart-gift">${isChacabucoPromo(item) ? 'Regalo fijo: Chacabuco Cabernet Franc sin cargo' : '3 cajas + 1 de regalo'}</span>
        ${renderPromoVariantSelector(item, index)}
      </div>
    `;
  }
  if(isChacabucoCheninPromo(item)) {
    return `
      <div class="cart-item-meta promo-cart-meta">
        <span class="promo-cart-pill">Promo Chenin</span>
        <span>Comprando Chacabuco varietal lleva al mismo precio Chacabuco Chenin Dulce.</span>
      </div>
    `;
  }
  return `<div class="cart-item-meta">${item.type}${item.specs ? renderMiniSpecs(item.specs) : (item.meta ? ' &middot; ' + item.meta : '')}</div>`;
}

function addToCart(product) {
  if(isChacabucoPromo(product)) applyChacabucoPromoVariant(product, product.variantKey);
  if(isChacabucoCheninCandidate(product) && !isChacabucoCheninPromo(product)) {
    if(maxCheninPromoQty() <= cheninPromoQty()) return;
    product = cheninPromoProduct();
  }
  const key = cartItemKey(product);
  const existing = cart.find(item => cartItemKey(item) === key);
  if(existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  syncCheninPromoLimit();
  renderCart();
  openCart();
}

function changeQty(index, delta) {
  if(!cart[index]) return;
  cart[index].qty += delta;
  if(cart[index].qty <= 0) cart.splice(index, 1);
  syncCheninPromoLimit();
  renderCart();
}

function changePromoVariant(index, variantKey) {
  const item = cart[index];
  if(!isChacabucoPromo(item) || !CHACABUCO_PROMO_VARIANTS[variantKey]) return;

  const targetKey = [item.promoId || item.name, variantKey].join('::');
  const existingIndex = cart.findIndex((candidate, candidateIndex) => (
    candidateIndex !== index && isChacabucoPromo(candidate) && promoCartKey(candidate) === targetKey
  ));

  if(existingIndex >= 0) {
    cart[existingIndex].qty += item.qty;
    cart.splice(index, 1);
  } else {
    applyChacabucoPromoVariant(item, variantKey);
  }
  syncCheninPromoLimit();
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCheninUpsell() {
  const maxQty = maxCheninPromoQty();
  if(maxQty <= 0) return '';

  const currentQty = cheninPromoQty();
  const canAdd = currentQty < maxQty;
  return `
    <div class="cart-upsell chenin-upsell">
      <div class="cart-upsell-media">
        <img src="${CHACABUCO_CHENIN_IMAGE}" alt="Chacabuco Chenin Dulce">
      </div>
      <div class="cart-upsell-body">
        <div class="cart-upsell-kicker">Chacabuco + Chenin</div>
        <div class="cart-upsell-title">Sumar Chacabuco Chenin Dulce</div>
        <p>Comprando Chacabuco varietal llev&aacute; al mismo precio Chacabuco Chenin Dulce.</p>
        <strong>Caja x6: $36.887,20</strong>
        <small>No cuenta la Promo Chacabuco 3+1 como habilitante.</small>
      </div>
      <div class="cart-upsell-actions">
        <button class="cart-upsell-add" type="button" onclick="addCheninPromo()" ${canAdd ? '' : 'disabled'}>Agregar Chenin</button>
        <div class="qty-control chenin-addon-control">
          <button type="button" onclick="changeCheninPromoQty(-1)" ${currentQty > 0 ? '' : 'disabled'}>-</button>
          <span>${currentQty}/${maxQty}</span>
          <button type="button" onclick="changeCheninPromoQty(1)" ${canAdd ? '' : 'disabled'}>+</button>
        </div>
      </div>
    </div>
  `;
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
  const itemsHtml = cart.map((item, index) => `
    <div class="cart-item${isPromoPurchase(item) || isChacabucoCheninPromo(item) ? ' promo-cart-item' : ''}">
      ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<div></div>'}
      <div>
        <div class="cart-item-name">${item.name}</div>
        ${renderCartMeta(item, index)}${renderPriceLine(item)}
      </div>
      <div class="qty-control">
        <button type="button" onclick="changeQty(${index}, -1)">-</button>
        <span>${item.qty}</span>
        <button type="button" onclick="changeQty(${index}, 1)">+</button>
      </div>
    </div>
  `).join('');
  list.innerHTML = `${itemsHtml}${renderCheninUpsell()}`;
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
