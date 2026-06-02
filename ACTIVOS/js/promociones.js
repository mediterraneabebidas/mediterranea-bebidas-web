(function() {
  const PROMO_ID = 'chacabuco-3x1';
  const PROMO_BOX_PRICE = 24129;
  const PROMO_PRICE = PROMO_BOX_PRICE * 3;
  const PROMO_GIFT_LABEL = 'Chacabuco Cabernet Franc sin cargo';
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

    const mainBottle = document.querySelector('[data-promo-main-bottle]');
    if(mainBottle) {
      mainBottle.src = variant.image;
      mainBottle.alt = variant.label;
    }

    const featured = document.querySelector('.promo-card.promo-featured');
    if(featured) featured.dataset.activeVariant = selectedPromoVariant;
  }

  function selectChacabucoPromoVariant(key) {
    selectedPromoVariant = PROMO_VARIANTS[key] ? key : 'malbec';
    updateChacabucoPromoVisual();
  }

  function chacabucoPromoMeta(key = selectedPromoVariant) {
    const variant = promoVariant(key);
    return `3 cajas ${variant.label} + 1 caja ${PROMO_GIFT_LABEL}`;
  }

  function chacabucoPromoSpecs(key = selectedPromoVariant) {
    const variant = promoVariant(key);
    return {
      variety: `${variant.variety} + Cabernet Franc bonificado`,
      provenance: 'Mendoza',
      quantity: '4 cajas x6 (3 pagas + 1 sin cargo)'
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

  window.scrollPromos = scrollPromos;
  window.selectChacabucoPromoVariant = selectChacabucoPromoVariant;
  window.updateChacabucoPromoVisual = updateChacabucoPromoVisual;
  window.addChacabucoPromoToCart = addChacabucoPromoToCart;

  updateChacabucoPromoVisual();
})();
