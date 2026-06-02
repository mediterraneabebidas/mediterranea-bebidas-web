function renderCatalogTabs(tabs = [], otherBrands = []) {
  const container = document.getElementById('catalogTabs');
  if(!container) return;
  container.innerHTML = tabs.map(tab => {
    const button = `<button class="tab-btn${tab.active ? ' active' : ''}" onclick="showTab('${escapeHtml(tab.id)}', event)">${escapeHtml(tab.label)}</button>`;
    if(!tab.otherBrands) return button;
    const menu = otherBrands.map(brand => `<a href="#tab-otros">${escapeHtml(brand)}</a>`).join('');
    return `<div class="other-brands-wrap">${button}<div class="other-brands-menu" aria-label="Listado de otras marcas">${menu}</div></div>`;
  }).join('');
}

function renderProductCard(product) {
  const price = product.price;
  const priceHtml = price ? `
    <div class="wine-price" data-price="${escapeHtml(price.value)}" data-price-label="${escapeHtml(price.label)}" data-price-code="${escapeHtml(price.code)}"${price.packSize ? ` data-pack-size="${escapeHtml(price.packSize)}"` : ''}><span>${escapeHtml(price.displayLabel)}</span><strong>${escapeHtml(price.displayValue)}</strong></div>` : '';
  return `
    <div class="wine-card"><div class="wine-image"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt || product.name)}"></div><div class="wine-type-badge ${escapeHtml(product.badgeClass)}">${escapeHtml(product.type)}</div><div class="wine-name">${escapeHtml(product.name)}</div><div class="wine-varietal">${escapeHtml(product.varietal)}</div>${priceHtml}</div>`;
}

function renderCatalogPanels(panels = []) {
  const container = document.getElementById('catalogPanels');
  if(!container) return;
  container.innerHTML = panels.map(panel => `
    <div class="catalog-panel${panel.active ? ' active' : ''}" id="tab-${escapeHtml(panel.id)}">
      ${panel.sections.map(section => `
        <div class="bodega-section">
          <div class="bodega-name">${escapeHtml(section.name)}</div>
          <div class="bodega-desc">${escapeHtml(section.description)}</div>
          <div class="wine-grid">
            ${section.products.map(renderProductCard).join('')}
          </div>
        </div>`).join('')}
    </div>`).join('');
}

async function loadCatalog() {
  const response = await fetch(CATALOG_URL, { cache: 'no-store' });
  if(!response.ok) throw new Error(`No se pudo cargar ${CATALOG_URL}`);
  const catalog = await response.json();
  renderCatalogTabs(catalog.tabs, catalog.otherBrands);
  renderCatalogPanels(catalog.panels);
}

function parseWineSpecs(meta) {
  const parts = String(meta || '')
    .split(/\s*Â·\s*/)
    .map(part => part.trim())
    .filter(Boolean);
  const quantityPattern = /(\d+\s*(ml|l)\b|presentaci[oÃ³]n|familiar|damajuana|mimbre|bag\s*in\s*box)/i;
  const provenancePattern = /(valle|mendoza|rioja|salta|calchaqu|maip|luj[aÃ¡]n|consulta|san carlos|villa seca|zona este|norte|famatina|patagonia|argentina)/i;
  let quantity = 'A confirmar';
  if(parts.length && quantityPattern.test(parts[parts.length - 1])) {
    quantity = parts.pop();
  }
  const provenanceIndex = parts.findIndex(part => provenancePattern.test(part));
  let varietyParts = parts;
  let provenanceParts = [];
  if(provenanceIndex >= 0) {
    varietyParts = parts.slice(0, provenanceIndex);
    provenanceParts = parts.slice(provenanceIndex);
  }
  const variety = varietyParts.length ? varietyParts.join(' Â· ') : 'A confirmar';
  const provenance = provenanceParts.length ? provenanceParts.join(' Â· ') : 'A confirmar';
  return { variety, provenance, quantity };
}

function specSummary(specs) {
  if(!specs) return '';
  return `Variedad: ${specs.variety} Â· Procedencia: ${specs.provenance} Â· Cantidad: ${specs.quantity}`;
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
    const specs = parseWineSpecs(rawMeta);
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
  const basePrice = priceEl ? Number(priceEl.dataset.price) : null;
  const packSize = getPackSize(priceEl);
  const purchaseMode = isUnitProduct({ type: productType }) ? 'unit' : getSelectedPurchaseMode(card);
  const price = purchaseMode === 'unit' && !isUnitProduct({ type: productType })
    ? unitPriceFromBox(basePrice, packSize)
    : basePrice;
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
  const productType = card.querySelector('.wine-type-badge')?.textContent.trim() || '';
  if(isUnitProduct({ type: productType })) return 'unit';
  return card.querySelector('.purchase-mode-option.active')?.dataset.purchaseMode || 'box';
}

function updateProductPriceMode(card, mode = getSelectedPurchaseMode(card)) {
  const productType = card.querySelector('.wine-type-badge')?.textContent.trim() || '';
  const unitOnly = isUnitProduct({ type: productType });
  const priceEl = card.querySelector('.wine-price');
  const addBtn = card.querySelector('.add-to-cart');
  const packSize = getPackSize(priceEl);
  const normalizedMode = unitOnly ? 'unit' : mode;
  card.dataset.purchaseMode = normalizedMode;
  card.querySelectorAll('.purchase-mode-option').forEach(option => {
    option.classList.toggle('active', option.dataset.purchaseMode === normalizedMode);
  });
  if(priceEl) {
    const basePrice = Number(priceEl.dataset.price);
    const price = normalizedMode === 'unit' && !unitOnly ? unitPriceFromBox(basePrice, packSize) : basePrice;
    const label = priceEl.querySelector('span');
    const value = priceEl.querySelector('strong');
    if(label) label.textContent = purchaseModeLabel(normalizedMode, packSize);
    if(value && Number.isFinite(price)) value.textContent = formatPrice(price);
  }
  if(addBtn) addBtn.textContent = `Agregar ${purchaseModeLabel(normalizedMode, packSize)}`;
}

function setupPurchaseMode(card) {
  const productType = card.querySelector('.wine-type-badge')?.textContent.trim() || '';
  if(isUnitProduct({ type: productType }) || card.querySelector('.purchase-mode')) return;
  const priceEl = card.querySelector('.wine-price');
  const packSize = getPackSize(priceEl);
  const control = document.createElement('div');
  control.className = 'purchase-mode';
  control.setAttribute('aria-label', 'Elegir precio');
  control.innerHTML = `
    <button type="button" class="purchase-mode-option" data-purchase-mode="unit">Unidad</button>
    <button type="button" class="purchase-mode-option active" data-purchase-mode="box">Caja x${packSize}</button>
  `;
  control.querySelectorAll('.purchase-mode-option').forEach(option => {
    option.addEventListener('click', () => updateProductPriceMode(card, option.dataset.purchaseMode));
  });
  if(priceEl) priceEl.insertAdjacentElement('afterend', control);
  else card.appendChild(control);
  const note = document.createElement('div');
  note.className = 'purchase-mode-note';
  note.textContent = `Precio unitario calculado desde la caja x${packSize}.`;
  control.insertAdjacentElement('afterend', note);
  updateProductPriceMode(card, 'box');
}

function setupCartButtons() {
  document.querySelectorAll('.wine-card').forEach(card => {
    if(card.querySelector('.add-to-cart')) return;
    const btn = document.createElement('button');
    const productType = card.querySelector('.wine-type-badge')?.textContent.trim() || '';
    btn.type = 'button';
    btn.className = 'add-to-cart';
    setupPurchaseMode(card);
    card.appendChild(btn);
    updateProductPriceMode(card, isUnitProduct({ type: productType }) ? 'unit' : getSelectedPurchaseMode(card));
    btn.addEventListener('click', () => addToCart(getProductFromCard(card)));
  });
}
