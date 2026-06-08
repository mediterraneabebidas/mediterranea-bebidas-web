(function() {
  const PROMO_ID = 'chacabuco-3x1';
  const PROMO_BOX_PRICE = 24129;
  const PROMO_PRICE = PROMO_BOX_PRICE * 3;
  const PROMO_GIFT_LABEL = 'Chacabuco Cabernet Franc sin cargo';
  const PROMO_GIFT_DETAIL = '1 caja Chacabuco Cabernet Franc sin cargo';
  const PROMO_VARIANTS = {
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

  let selectedPromoVariant = 'malbec';

  function promoVariant(key = selectedPromoVariant) {
    return PROMO_VARIANTS[key] || PROMO_VARIANTS.malbec;
  }

  function scrollPromos(direction) {
    const track = document.getElementById('promoTrack');
    if(!track) return;
    const amount = Math.min(track.clientWidth * 0.82, 520);
    track.scrollBy({ left: amount * direction, behavior: 'smooth' });
  }

  function updateChacabucoPromoVisual() {
    const variant = promoVariant();
    document.querySelectorAll('[data-promo-variant]').forEach(button => {
      button.classList.toggle('active', button.dataset.promoVariant === selectedPromoVariant);
      button.setAttribute('aria-pressed', button.dataset.promoVariant === selectedPromoVariant ? 'true' : 'false');
    });

    document.querySelectorAll('[data-promo-buy-bottle]').forEach(bottle => {
      bottle.src = variant.image;
      bottle.alt = variant.label;
    });

    const featured = document.querySelector('.promo-card.promo-featured');
    if(featured) featured.dataset.activeVariant = selectedPromoVariant;
  }

  function selectChacabucoPromoVariant(key) {
    selectedPromoVariant = PROMO_VARIANTS[key] ? key : 'malbec';
    updateChacabucoPromoVisual();
  }

  function chacabucoPromoMeta(key = selectedPromoVariant) {
    const variant = promoVariant(key);
    return `3 cajas ${variant.label} + ${PROMO_GIFT_DETAIL}`;
  }

  function chacabucoPromoSpecs(key = selectedPromoVariant) {
    const variant = promoVariant(key);
    return {
      variety: `${variant.variety} + Cabernet Franc bonificado`,
      provenance: 'Mendoza',
      quantity: '4 cajas x6 (3 pagas + 1 Cabernet Franc sin cargo)'
    };
  }

  function addChacabucoPromoToCart() {
    if(typeof window.addToCart !== 'function') {
      const button = document.querySelector('.promo-gift-note');
      if(button) button.textContent = 'Promo pendiente de carrito';
      return;
    }

    const variant = promoVariant();
    window.addToCart({
      promoId: PROMO_ID,
      variantKey: selectedPromoVariant,
      name: 'Promo Chacabuco 3+1',
      meta: chacabucoPromoMeta(),
      specs: chacabucoPromoSpecs(),
      type: 'Promo',
      image: variant.image,
      price: PROMO_PRICE,
      basePrice: PROMO_PRICE,
      packSize: 6,
      purchaseMode: 'promo',
      purchaseLabel: 'promo 3+1',
      priceLabel: typeof window.formatPrice === 'function' ? window.formatPrice(PROMO_PRICE) : `$${PROMO_PRICE}`,
      priceCode: PROMO_ID
    });

    const featured = document.querySelector('.promo-card.promo-featured');
    const button = document.querySelector('.promo-gift-note');
    if(featured) {
      featured.classList.add('promo-added');
      window.setTimeout(() => featured.classList.remove('promo-added'), 900);
    }
    if(button) {
      const originalText = button.dataset.originalText || button.textContent;
      button.dataset.originalText = originalText;
      button.textContent = `Promo ${variant.shortLabel} agregada`;
      window.setTimeout(() => { button.textContent = originalText; }, 1400);
    }
  }

  function setCheninPromoStatus(message, type = '') {
    const status = document.querySelector('[data-chenin-promo-status]');
    if(!status) return;
    status.textContent = message;
    status.className = `promo-chenin-status visible ${type}`.trim();
  }

  function pulseChacabucoPromoCard() {
    const featured = document.querySelector('.promo-card.promo-featured');
    if(!featured) return;
    featured.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    featured.classList.add('promo-added');
    window.setTimeout(() => featured.classList.remove('promo-added'), 1100);
  }

  function addCheninPromoAddonFromRail() {
    if(typeof window.addCheninAddon !== 'function' || typeof window.maxCheninAddonQty !== 'function') {
      setCheninPromoStatus('El complemento Chenin se suma desde el carrito.', 'warning');
      return;
    }

    if(window.maxCheninAddonQty() <= 0) {
      setCheninPromoStatus('Primero agregá la Promo Chacabuco 3+1 para sumar Chenin como complemento.', 'warning');
      pulseChacabucoPromoCard();
      return;
    }

    if(typeof window.canAddCheninAddon === 'function' && !window.canAddCheninAddon()) {
      setCheninPromoStatus('Ya alcanzaste el máximo de Chenin para las promos cargadas.', 'warning');
      if(typeof window.openCart === 'function') window.openCart();
      return;
    }

    window.addCheninAddon();
    if(typeof window.openCart === 'function') window.openCart();
    setCheninPromoStatus('Chenin agregado como complemento pago en el carrito.', 'success');
  }

  window.scrollPromos = scrollPromos;
  window.selectChacabucoPromoVariant = selectChacabucoPromoVariant;
  window.updateChacabucoPromoVisual = updateChacabucoPromoVisual;
  window.addChacabucoPromoToCart = addChacabucoPromoToCart;
  window.addCheninPromoAddonFromRail = addCheninPromoAddonFromRail;

  updateChacabucoPromoVisual();
})();
