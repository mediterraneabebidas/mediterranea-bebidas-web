const THEME_STORAGE_KEY = 'mediterranea-theme';

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {}
}

function applyInitialTheme() {
  const savedTheme = getSavedTheme();
  document.body.classList.toggle('dark-theme', savedTheme !== 'light');
}

applyInitialTheme();

function setThemeButtonLabel() {
  const btn = document.querySelector('.theme-toggle');
  if(!btn) return;
  const isDark = document.body.classList.contains('dark-theme');
  btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  saveTheme(isDark ? 'dark' : 'light');
  setThemeButtonLabel();
}

function normalizeOtherBrand(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const normalizeCatalogSearch = normalizeOtherBrand;
let catalogSearchTerm = '';

function updateCatalogCardVisibility(card) {
  card.hidden = card.dataset.hiddenOtherBrand === 'true' || card.dataset.hiddenSearch === 'true';
}

function updateCatalogSectionVisibility(panel) {
  if(!panel) return 0;
  let visibleCount = 0;
  panel.querySelectorAll('.bodega-section').forEach(section => {
    const visibleCards = section.querySelectorAll('.wine-card:not([hidden])').length;
    section.hidden = visibleCards === 0;
    visibleCount += visibleCards;
  });
  return visibleCount;
}

function activeCatalogPanel() {
  return document.querySelector('.catalog-panel.active');
}

function updateCatalogSearchStatus(count = 0) {
  const status = document.getElementById('catalogSearchStatus');
  if(!status) return;
  status.textContent = catalogSearchTerm
    ? `${count} producto${count === 1 ? '' : 's'} encontrado${count === 1 ? '' : 's'}`
    : '';
}

function applyCatalogSearch() {
  const term = normalizeCatalogSearch(catalogSearchTerm);
  document.querySelectorAll('.catalog-panel').forEach(panel => {
    panel.querySelectorAll('.wine-card').forEach(card => {
      const sectionText = card.closest('.bodega-section')?.dataset.searchSection || '';
      const haystack = normalizeCatalogSearch(`${card.dataset.searchText || ''} ${sectionText}`);
      card.dataset.hiddenSearch = term && !haystack.includes(term) ? 'true' : 'false';
      updateCatalogCardVisibility(card);
    });
    updateCatalogSectionVisibility(panel);
  });
  updateCatalogSearchStatus(updateCatalogSectionVisibility(activeCatalogPanel()));
}

function setupCatalogSearch() {
  const input = document.getElementById('catalogSearchInput');
  if(!input || input.dataset.catalogSearchBound === 'true') return;
  input.dataset.catalogSearchBound = 'true';
  const clearButton = document.querySelector('[data-catalog-search-clear]');

  input.addEventListener('input', () => {
    catalogSearchTerm = input.value;
    if(clearButton) clearButton.hidden = !catalogSearchTerm;
    applyCatalogSearch();
  });

  clearButton?.addEventListener('click', () => {
    input.value = '';
    catalogSearchTerm = '';
    clearButton.hidden = true;
    applyCatalogSearch();
    input.focus();
  });
}

setupCatalogSearch();

function activateCatalogTab(id) {
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.tabId === id);
  });
}

function activateOtherBrandOption(brand = '') {
  const normalizedBrand = normalizeOtherBrand(brand);
  document.querySelectorAll('.other-brand-option').forEach(button => {
    const buttonBrand = normalizeOtherBrand(button.dataset.otherBrand);
    button.classList.toggle('active', normalizedBrand ? buttonBrand === normalizedBrand : !buttonBrand);
  });
}

function updateOtherBrandFilterBar(brand = '', count = 0) {
  const panel = document.getElementById('tab-otros');
  const bar = panel?.querySelector('.other-brand-filter-bar');
  if(!bar) return;
  bar.hidden = !brand;
  if(!brand) return;
  const label = bar.querySelector('[data-other-brand-label]');
  const total = bar.querySelector('[data-other-brand-count]');
  if(label) label.textContent = brand;
  if(total) total.textContent = `${count} producto${count === 1 ? '' : 's'}`;
}

function resetOtherBrandFilter() {
  const panel = document.getElementById('tab-otros');
  if(!panel) return;
  panel.dataset.activeOtherBrand = '';
  panel.querySelectorAll('.wine-card').forEach(card => {
    card.dataset.hiddenOtherBrand = 'false';
    updateCatalogCardVisibility(card);
  });
  updateCatalogSectionVisibility(panel);
  updateOtherBrandFilterBar('', 0);
  activateOtherBrandOption('');
}

function showTab(id, evt) {
  document.querySelectorAll('.catalog-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + id);
  if(panel) panel.classList.add('active');
  activateCatalogTab(id);
  resetOtherBrandFilter();
  if(id !== 'otros') activateOtherBrandOption('');
  applyCatalogSearch();
  closeOtherBrandsMenu();
}

function showOtherBrand(brand) {
  const panel = document.getElementById('tab-otros');
  if(!panel) return;
  showTab('otros');
  const normalizedBrand = normalizeOtherBrand(brand);
  let visibleCount = 0;
  panel.querySelectorAll('.wine-card').forEach(card => {
    const matches = normalizeOtherBrand(card.dataset.otherBrand) === normalizedBrand;
    card.dataset.hiddenOtherBrand = matches ? 'false' : 'true';
    updateCatalogCardVisibility(card);
    if(!card.hidden) visibleCount += 1;
  });
  updateCatalogSectionVisibility(panel);
  panel.dataset.activeOtherBrand = brand;
  updateOtherBrandFilterBar(brand, visibleCount);
  activateCatalogTab('otros');
  activateOtherBrandOption(brand);
  closeOtherBrandsMenu(true);
}

function setOtherBrandsMenuOpen(wrap, isOpen) {
  if(!wrap) return;
  wrap.classList.toggle('open', isOpen);
  wrap.querySelector('[data-other-brands-toggle]')?.setAttribute('aria-expanded', String(isOpen));
}

function closeOtherBrandsMenu(lockClosed = false) {
  document.querySelectorAll('[data-other-brands-wrap]').forEach(wrap => {
    setOtherBrandsMenuOpen(wrap, false);
    wrap.classList.toggle('is-locked-closed', lockClosed);
  });
  if(lockClosed && document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function setupOtherBrandsMenu() {
  const tabs = document.getElementById('catalogTabs');
  const panels = document.getElementById('catalogPanels');
  if(tabs && tabs.dataset.otherBrandsBound !== 'true') {
    tabs.dataset.otherBrandsBound = 'true';
    tabs.addEventListener('click', event => {
      const option = event.target.closest('[data-other-brand-option]');
      if(option) {
        event.preventDefault();
        const brand = option.dataset.otherBrand || '';
        if(brand) showOtherBrand(brand);
        else showTab('otros');
        closeOtherBrandsMenu(true);
        return;
      }

      const toggle = event.target.closest('[data-other-brands-toggle]');
      if(toggle) {
        const wrap = toggle.closest('[data-other-brands-wrap]');
        const wasOpen = wrap?.classList.contains('open');
        showTab('otros');
        wrap?.classList.toggle('is-locked-closed', Boolean(wasOpen));
        setOtherBrandsMenuOpen(wrap, !wasOpen);
      }
    });
  }

  if(panels && panels.dataset.otherBrandsBound !== 'true') {
    panels.dataset.otherBrandsBound = 'true';
    panels.addEventListener('click', event => {
      const option = event.target.closest('[data-other-brand-option]');
      if(!option) return;
      event.preventDefault();
      const brand = option.dataset.otherBrand || '';
      if(brand) showOtherBrand(brand);
      else showTab('otros');
    });
  }

  document.querySelectorAll('[data-other-brands-wrap]').forEach(wrap => {
    if(wrap.dataset.pointerBound === 'true') return;
    wrap.dataset.pointerBound = 'true';
    wrap.addEventListener('pointerleave', () => {
      wrap.classList.remove('is-locked-closed');
      setOtherBrandsMenuOpen(wrap, false);
    });
  });
}

document.addEventListener('click', event => {
  if(event.target.closest('[data-other-brands-wrap]')) return;
  closeOtherBrandsMenu();
});

document.addEventListener('keydown', event => {
  if(event.key === 'Escape') closeOtherBrandsMenu();
});

function setupSiteCursor() {
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  document.documentElement.classList.add('custom-cursor-active');

  const cursor = document.createElement('div');
  cursor.className = 'site-cursor hidden';
  document.body.appendChild(cursor);

  let x = -80;
  let y = -80;
  let frame = null;

  function paint() {
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    frame = null;
  }

  function moveCursor(event) {
    x = event.clientX;
    y = event.clientY;
    cursor.classList.remove('hidden');
    if(!frame) frame = requestAnimationFrame(paint);
  }

  window.addEventListener('pointermove', moveCursor, { passive:true });
  window.addEventListener('mousemove', moveCursor, { passive:true });

  document.addEventListener('pointerover', (event) => {
    const hot = event.target.closest('a, button, [role="button"], .tab-btn, .wine-card, .bodega-card, .add-to-cart, .cart-toggle');
    cursor.classList.toggle('hover', Boolean(hot));
  }, true);

  document.addEventListener('mouseleave', () => {
    cursor.classList.add('hidden');
  });

  window.addEventListener('blur', () => {
    cursor.classList.add('hidden');
  });
}

setupSiteCursor();

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

window.addEventListener('scroll', () => {
  const sections = ['inicio','nosotros','catalogo','bodegas','contacto'];
  const scrollY = window.scrollY;
  sections.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    const top = el.offsetTop - 100;
    const bottom = top + el.offsetHeight;
    if(scrollY >= top && scrollY < bottom) {
      document.querySelectorAll('.nav-links a').forEach(a => {
        a.style.color = a.getAttribute('href') === '#' + id ? 'var(--accent)' : '';
      });
    }
  });
});

setThemeButtonLabel();
