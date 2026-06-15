let catalogOtherBrands = [];

function normalizeCatalogLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function inferOtherBrand(product, otherBrands = catalogOtherBrands) {
  const text = normalizeCatalogLabel([product.name, product.alt].filter(Boolean).join(' '));
  return otherBrands.find(brand => text.includes(normalizeCatalogLabel(brand))) || '';
}

function renderCatalogTabs(tabs = [], otherBrands = []) {
  const container = document.getElementById('catalogTabs');
  if(!container) return;
  container.innerHTML = tabs.map(tab => {
    const buttonClass = `tab-btn${tab.active ? ' active' : ''}${tab.otherBrands ? ' other-brands-toggle' : ''}`;
    const toggleAttrs = tab.otherBrands ? ' data-other-brands-toggle="true" aria-haspopup="true" aria-expanded="false"' : '';
    const clickAttr = tab.otherBrands ? '' : ` onclick="showTab('${escapeHtml(tab.id)}', event)"`;
    const button = `<button type="button" class="${buttonClass}" data-tab-id="${escapeHtml(tab.id)}"${clickAttr}${toggleAttrs}>${escapeHtml(tab.label)}</button>`;
    if(!tab.otherBrands) return button;
    const menu = [
      '<button type="button" class="other-brand-option other-brand-all" data-other-brand-option="true" data-other-brand="">Ver todas las marcas</button>',
      ...otherBrands.map(brand => `<button type="button" class="other-brand-option" data-other-brand-option="true" data-other-brand="${escapeHtml(brand)}">${escapeHtml(brand)}</button>`)
    ].join('');
    return `<div class="other-brands-wrap" data-other-brands-wrap="true">${button}<div class="other-brands-menu" aria-label="Listado de otras marcas">${menu}</div></div>`;
  }).join('');
  if(typeof setupOtherBrandsMenu === 'function') setupOtherBrandsMenu();
}

function renderProductCard(product, otherBrands = catalogOtherBrands) {
  const price = product.price;
  const priceHtml = price ? `
    <div class="wine-price" data-price="${escapeHtml(price.value)}" data-price-label="${escapeHtml(price.label)}" data-price-code="${escapeHtml(price.code)}"${price.packSize ? ` data-pack-size="${escapeHtml(price.packSize)}"` : ''}><span>${escapeHtml(price.displayLabel)}</span><strong>${escapeHtml(price.displayValue)}</strong></div>` : '';
  const otherBrand = inferOtherBrand(product, otherBrands);
  const otherBrandAttr = otherBrand ? ` data-other-brand="${escapeHtml(otherBrand)}"` : '';
  const searchText = [
    product.name,
    product.alt,
    product.type,
    product.varietal,
    product.category,
    otherBrand
  ].filter(Boolean).join(' ');
  return `
    <div class="wine-card"${otherBrandAttr} data-search-text="${escapeHtml(searchText)}"><div class="wine-image"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt || product.name)}"></div><div class="wine-type-badge ${escapeHtml(product.badgeClass)}">${escapeHtml(product.type)}</div><div class="wine-name">${escapeHtml(product.name)}</div><div class="wine-varietal">${escapeHtml(product.varietal)}</div>${priceHtml}</div>`;
}

function renderCatalogPanels(panels = [], otherBrands = catalogOtherBrands) {
  const container = document.getElementById('catalogPanels');
  if(!container) return;
  container.innerHTML = panels.map(panel => `
    <div class="catalog-panel${panel.active ? ' active' : ''}" id="tab-${escapeHtml(panel.id)}">
      ${panel.id === 'otros' ? `
        <div class="other-brand-filter-bar" hidden>
          <div>
            <span class="other-brand-filter-kicker">Filtro activo</span>
            <strong data-other-brand-label></strong>
            <small data-other-brand-count></small>
          </div>
          <div class="other-brand-filter-actions">
            <button type="button" data-other-brand-option="true" data-other-brand="">Ver todas las marcas</button>
            <button type="button" onclick="showTab('todos')">Todos</button>
          </div>
        </div>` : ''}
      ${panel.sections.map(section => `
        <div class="bodega-section" data-search-section="${escapeHtml([section.name, section.description, panel.label].filter(Boolean).join(' '))}">
          <div class="bodega-name">${escapeHtml(section.name)}</div>
          <div class="bodega-desc">${escapeHtml(section.description)}</div>
          <div class="wine-grid">
            ${section.products.map(product => renderProductCard({
              ...product,
              category: [panel.label, section.name, section.description].filter(Boolean).join(' ')
            }, otherBrands)).join('')}
          </div>
        </div>`).join('')}
    </div>`).join('');
  if(typeof setupOtherBrandsMenu === 'function') setupOtherBrandsMenu();
  if(typeof setupCatalogSearch === 'function') setupCatalogSearch();
  if(typeof applyCatalogSearch === 'function') applyCatalogSearch();
}

async function loadCatalog() {
  const response = await fetch(CATALOG_URL, { cache: 'no-store' });
  if(!response.ok) throw new Error(`No se pudo cargar ${CATALOG_URL}`);
  const catalog = await response.json();
  catalogOtherBrands = catalog.otherBrands || [];
  renderCatalogTabs(catalog.tabs, catalog.otherBrands);
  renderCatalogPanels(catalog.panels, catalog.otherBrands);
}

function normalizeSpecText(value) {
  return String(value || '')
    .replace(/\u00C2\u00B7/g, '·')
    .replace(/&middot;/gi, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSpecParts(meta) {
  const normalized = normalizeSpecText(meta);
  if(!normalized) return [];
  return normalized
    .split(/\s*(?:\u00C2\u00B7|·|&middot;|•|\|)\s*/i)
    .map(part => part.trim())
    .filter(Boolean);
}

function isQuantityPart(part) {
  const text = normalizeSpecText(part).toLowerCase();
  return /^(?:\d+(?:[.,]\d+)?\s*(?:ml|l|cc)\b|caja\s*x\s*\d+|presentaci[oó]n\b|presentaci[oó]n\s+familiar|familiar|damajuana|damajuana\s+mimbre|mimbre|bag\s*in\s*box)/i.test(text);
}

function quantityFallback(label) {
  const text = normalizeSpecText(label);
  return text && !/^\$/.test(text) ? text : 'A confirmar';
}

function parseWineSpecs(meta, fallbackQuantity = '') {
  const parts = splitSpecParts(meta);
  const provenancePattern = /\b(valle|mendoza|la\s+rioja|rioja|salta|calchaqu|maip|luj[aá]n|consulta|san carlos|villa seca|zona este|norte|famatina|patagonia|argentina)\b/i;
  let quantity = quantityFallback(fallbackQuantity);
  if(parts.length > 1 && isQuantityPart(parts[parts.length - 1])) {
    quantity = parts.pop();
  } else if(parts.length === 1) {
    const trailingQuantity = parts[0].match(/^(.*?)(\d+(?:[.,]\d+)?\s*(?:ml|l|cc)\b)$/i);
    if(trailingQuantity && trailingQuantity[1].trim()) {
      parts[0] = trailingQuantity[1].trim();
      quantity = trailingQuantity[2].trim();
    } else if(isQuantityPart(parts[0])) {
      quantity = parts.pop();
    }
  }
  const provenanceIndex = parts.findIndex(part => provenancePattern.test(part));
  let varietyParts = parts;
  let provenanceParts = [];
  if(provenanceIndex >= 0) {
    varietyParts = parts.slice(0, provenanceIndex);
    provenanceParts = parts.slice(provenanceIndex);
  }
  const variety = varietyParts.length ? varietyParts.join(' · ') : 'A confirmar';
  const provenance = provenanceParts.length ? provenanceParts.join(' · ') : 'A confirmar';
  return { variety, provenance, quantity };
}

function specSummary(specs) {
  if(!specs) return '';
  return `Variedad: ${specs.variety} · Procedencia: ${specs.provenance} · Cantidad: ${specs.quantity}`;
}

function specMessage(specs) {
  if(!specs) return '';
  return `Variedad: ${specs.variety}; Procedencia: ${specs.provenance}; Cantidad: ${specs.quantity}`;
}

function renderMiniSpecs(specs) {
  if(!specs) return '';
  return `
    <dl class="mini-specs">
      <div><dt>Variedad</dt><dd>${escapeHtml(specs.variety)}</dd></div>
      <div><dt>Origen</dt><dd>${escapeHtml(specs.provenance)}</dd></div>
      <div><dt>Cantidad</dt><dd>${escapeHtml(specs.quantity)}</dd></div>
    </dl>
  `;
}

function setupProductSpecs() {
  document.querySelectorAll('.wine-varietal').forEach(metaEl => {
    if(metaEl.dataset.structured === 'true') return;
    const rawMeta = metaEl.dataset.rawMeta || metaEl.textContent.trim();
    const fallbackQuantity = metaEl.closest('.wine-card')?.querySelector('.wine-price span')?.textContent.trim() || '';
    const specs = parseWineSpecs(rawMeta, fallbackQuantity);
    metaEl.dataset.rawMeta = rawMeta;
    metaEl.dataset.variety = specs.variety;
    metaEl.dataset.provenance = specs.provenance;
    metaEl.dataset.quantity = specs.quantity;
    metaEl.dataset.structured = 'true';
    metaEl.innerHTML = `
      <ul class="wine-spec-list">
        <li><span class="wine-spec-label">Variedad</span><span class="wine-spec-value">${escapeHtml(specs.variety)}</span></li>
        <li><span class="wine-spec-label">Procedencia</span><span class="wine-spec-value">${escapeHtml(specs.provenance)}</span></li>
        <li><span class="wine-spec-label">Cantidad</span><span class="wine-spec-value">${escapeHtml(specs.quantity)}</span></li>
      </ul>
    `;
  });
}

function productFromCardMeta(card) {
  const metaEl = card.querySelector('.wine-varietal');
  return {
    name: card.querySelector('.wine-name')?.textContent.trim() || '',
    type: card.querySelector('.wine-type-badge')?.textContent.trim() || '',
    meta: metaEl?.dataset.rawMeta || metaEl?.textContent.trim() || '',
    specs: metaEl?.dataset.quantity ? { quantity: metaEl.dataset.quantity } : null
  };
}

function getProductFromCard(card) {
  const metaEl = card.querySelector('.wine-varietal');
  const priceEl = card.querySelector('.wine-price');
  const rawMeta = metaEl?.dataset.rawMeta || metaEl?.textContent.trim() || '';
  const specs = metaEl?.dataset.variety
    ? {
        variety: metaEl.dataset.variety,
        provenance: metaEl.dataset.provenance,
        quantity: metaEl.dataset.quantity
      }
    : parseWineSpecs(rawMeta);
  const productType = card.querySelector('.wine-type-badge')?.textContent.trim() || '';
  const productMeta = productFromCardMeta(card);
  const basePrice = priceEl ? Number(priceEl.dataset.price) : null;
  const packSize = productPackSize({ ...productMeta, specs }, priceEl);
  const purchaseMode = purchaseModeForProduct({ ...productMeta, specs });
  const price = basePrice;
  return {
    name: card.querySelector('.wine-name')?.textContent.trim() || 'Producto',
    meta: rawMeta,
    specs,
    type: productType,
    image: card.querySelector('.wine-image img')?.getAttribute('src') || '',
    price: Number.isFinite(price) ? price : null,
    basePrice: Number.isFinite(basePrice) ? basePrice : null,
    packSize,
    purchaseMode,
    purchaseLabel: purchaseModeLabel(purchaseMode, packSize),
    priceLabel: priceEl?.dataset.priceLabel || '',
    priceCode: priceEl?.dataset.priceCode || ''
  };
}


function getSelectedPurchaseMode(card) {
  return purchaseModeForProduct(productFromCardMeta(card));
}

function updateProductPriceMode(card, mode = getSelectedPurchaseMode(card)) {
  const priceEl = card.querySelector('.wine-price');
  const addBtn = card.querySelector('.add-to-cart');
  const productMeta = productFromCardMeta(card);
  const packSize = productPackSize(productMeta, priceEl);
  const normalizedMode = purchaseModeForProduct(productMeta);
  card.dataset.purchaseMode = normalizedMode;
  if(priceEl) {
    const basePrice = Number(priceEl.dataset.price);
    const label = priceEl.querySelector('span');
    const value = priceEl.querySelector('strong');
    if(label) label.textContent = purchaseModeLabel(normalizedMode, packSize);
    if(value && Number.isFinite(basePrice)) value.textContent = formatPrice(basePrice);
  }
  if(addBtn) addBtn.textContent = `Agregar ${purchaseModeLabel(normalizedMode, packSize)}`;
}

function setupPurchaseMode(card) {
  updateProductPriceMode(card, getSelectedPurchaseMode(card));
}

function setupCartButtons() {
  document.querySelectorAll('.wine-card').forEach(card => {
    if(card.querySelector('.add-to-cart')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'add-to-cart';
    setupPurchaseMode(card);
    card.appendChild(btn);
    updateProductPriceMode(card, getSelectedPurchaseMode(card));
    btn.addEventListener('click', () => addToCart(getProductFromCard(card)));
  });
}
