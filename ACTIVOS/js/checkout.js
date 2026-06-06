let selectedPayment = 'mp';
let selectedDelivery = 'delivery';

function openCheckout() {
  if(!cart.length) {
    openCart();
    return;
  }
  closeCart();
  renderCheckoutSummary();
  document.getElementById('checkoutOverlay')?.classList.add('open');
  document.getElementById('checkoutModal')?.classList.add('open');
}

function closeCheckout() {
  document.getElementById('checkoutOverlay')?.classList.remove('open');
  document.getElementById('checkoutModal')?.classList.remove('open');
}

function selectDelivery(method, button) {
  selectedDelivery = method;
  document.querySelectorAll('.delivery-option').forEach(option => option.classList.remove('active'));
  button?.classList.add('active');
  const address = document.getElementById('buyerAddress');
  const label = document.getElementById('buyerAddressLabel');
  const result = document.getElementById('shippingResult');
  if(method === 'jbjusto') {
    if(label) label.textContent = 'Retiro seleccionado';
    if(address) {
      address.value = 'Retiro en Juan B. Justo 8620';
      address.readOnly = true;
    }
    if(result) result.textContent = 'Retiro por Juan B. Justo 8620. Coordinamos horario antes de confirmar el pago.';
  } else if(method === 'santina') {
    if(label) label.textContent = 'Retiro seleccionado';
    if(address) {
      address.value = 'Retiro en Valle Escondido - Santina Norte';
      address.readOnly = true;
    }
    if(result) result.textContent = 'Retiro por Valle Escondido, Santina Norte. Disponible para pedidos chicos.';
  } else {
    if(label) label.textContent = 'DirecciÃ³n exacta de entrega';
    if(address) {
      address.readOnly = false;
      if(address.value.startsWith('Retiro en ')) address.value = '';
      address.placeholder = 'Calle, altura, barrio, piso/depto';
    }
    calculateShipping();
  }
}

function shippingEstimateText() {
  return document.getElementById('shippingResult')?.textContent.trim() || 'Zona norte: envio a confirmar.';
}

function calculateShipping() {
  const zip = document.getElementById('deliveryZip')?.value.trim() || '';
  const result = document.getElementById('shippingResult');
  if(!result) return;
  if(!zip) {
    result.textContent = 'Zona norte: referencia desde Valle Escondido. Envios cercanos desde $2.000 y lejanos dentro de zona norte hasta $10.000.';
    return;
  }
  if(/^50\d{2}$/.test(zip)) {
    result.textContent = `CP ${zip}: cobertura en Cordoba Capital/zona norte a confirmar. Referencia: $2.000 cerca de Valle Escondido, hasta $10.000 para puntos mas lejanos dentro de zona norte.`;
  } else {
    result.textContent = `CP ${zip}: fuera de la referencia inmediata de zona norte. Consultamos cobertura y costo antes de generar el link de pago.`;
  }
}

function isCheckoutPromo(item) {
  return typeof isPromoPurchase === 'function'
    ? isPromoPurchase(item)
    : item?.purchaseMode === 'promo' || Boolean(item?.promoId);
}

function checkoutPromoDetail(item) {
  return item?.promoDetail || '3 cajas + 1 de regalo';
}

function checkoutPromoSelection(item) {
  return item?.meta || checkoutPromoDetail(item);
}

function checkoutPromoQuantityLabel(item) {
  if(typeof promoQuantityLabel === 'function') return promoQuantityLabel(item);
  return item?.qty === 1 ? 'promo 3+1' : 'promos 3+1';
}

function checkoutLinePriceVisual(item) {
  if(!Number.isFinite(item?.price)) return 'A confirmar';
  return formatPrice(item.price * item.qty);
}

function renderCheckoutMeta(item) {
  if(isCheckoutPromo(item)) {
    return `
      <div class="checkout-summary-meta promo-cart-meta">
        <span class="promo-cart-pill">Promo</span>
        <span>${escapeHtml(checkoutPromoSelection(item))}</span>
        <span class="promo-cart-gift">${escapeHtml(checkoutPromoDetail(item))}</span>
      </div>
    `;
  }
  return `<div class="checkout-summary-meta">${item.type}${item.specs ? renderMiniSpecs(item.specs) : (item.meta ? ' &middot; ' + item.meta : '')}</div>`;
}

function renderCheckoutSummary() {
  const summary = document.getElementById('checkoutSummary');
  const totalEl = document.getElementById('checkoutTotal');
  const totalNote = document.getElementById('checkoutTotalNote');
  if(!summary) return;
  if(!cart.length) {
    summary.innerHTML = '<div class="cart-empty">No hay productos en el carrito.</div>';
    if(totalEl) totalEl.textContent = 'Total a corroborar';
    if(totalNote) totalNote.textContent = 'Stock, precios, impuestos y envÃ­o se validan antes de generar el pago.';
    return;
  }
  const totals = cartTotals();
  if(totalEl) totalEl.textContent = totals.subtotal ? `${totals.missing ? 'Subtotal' : 'Total'} ${cartUnitSummary()} ${formatPrice(totals.subtotal)}` : 'Total a corroborar';
  if(totalNote) totalNote.textContent = totals.missing
    ? 'Hay productos sin precio en lista. El total final se confirma antes de generar el pago.'
    : 'Vinos y tetras se piden por caja. BIB y damajuanas se manejan como presentacion unica. Envio e impuestos se confirman antes de generar el pago.';
  summary.innerHTML = cart.map(item => `
    <div class="checkout-summary-item">
      ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<div></div>'}
      <div>
        <div class="checkout-summary-name">${item.name}</div>
        ${renderCheckoutMeta(item)}${renderCheckoutPriceLine(item)}
      </div>
      <strong>x${item.qty}</strong>
    </div>
  `).join('');
}

function deliveryLabel() {
  const deliveryLabels = {
    delivery: 'Envio a domicilio',
    jbjusto: 'Retiro en Juan B. Justo 8620',
    santina: 'Retiro en Valle Escondido - Santina Norte'
  };
  return deliveryLabels[selectedDelivery] || 'Envio a domicilio';
}

function orderLine(item) {
  if(isCheckoutPromo(item)) {
    const price = Number.isFinite(item.price) ? checkoutLinePriceVisual(item) : 'precio a confirmar';
    return `${item.qty} ${checkoutPromoQuantityLabel(item)} de ${item.name} (${checkoutPromoDetail(item)}; ${checkoutPromoSelection(item)}) - ${price}`;
  }
  return `${item.qty} ${quantityLabel(item)} de ${item.name}${item.specs ? ' (' + specMessage(item.specs) + ')' : (item.meta ? ' (' + item.meta + ')' : '')}${Number.isFinite(item.price) ? ' - ' + formatPrice(item.price * item.qty) : ' - precio a confirmar'}`;
}

function orderTotalLine() {
  const totals = cartTotals();
  if(!totals.subtotal) return 'Total estimado: a corroborar';
  return `${totals.missing ? 'Subtotal estimado' : 'Total estimado'}: ${formatPrice(totals.subtotal)}${totals.missing ? ' (hay productos con precio a confirmar)' : ''}`;
}

function checkoutMessage() {
  const name = document.getElementById('buyerName')?.value.trim() || '-';
  const phone = document.getElementById('buyerPhone')?.value.trim() || '-';
  const email = document.getElementById('buyerEmail')?.value.trim() || '-';
  const business = document.getElementById('buyerBusiness')?.value.trim() || '-';
  const address = document.getElementById('buyerAddress')?.value.trim() || '-';
  const zip = document.getElementById('deliveryZip')?.value.trim() || '-';
  const notes = document.getElementById('checkoutNotes')?.value.trim() || '-';
  const paymentDetail = 'Mercado Pago a coordinar luego de validar stock, envio y total';
  return [
    'Hola Mediterranea Bebidas, quiero finalizar esta compra:',
    ...cart.map(item => `- ${orderLine(item)}`),
    '',
    orderTotalLine(),
    '',
    `Metodo de pago: ${paymentDetail}`,
    `Entrega: ${deliveryLabel()}`,
    `Codigo postal: ${zip}`,
    `Costo envio estimado: ${shippingEstimateText()}`,
    `Nombre: ${name}`,
    `Telefono: ${phone}`,
    `Email: ${email}`,
    `Comercio: ${business}`,
    `Direccion/retiro: ${address}`,
    `Notas: ${notes}`,
    '',
    'Solicito confirmacion de stock, total no editable, envio y medio de pago seguro.'
  ].join('\n');
}

function checkoutPayloadItem(item) {
  const base = {
    name: item.name,
    type: item.type,
    quantity: item.qty,
    purchaseMode: isCheckoutPromo(item) ? 'promo' : (item.purchaseMode === 'presentation' ? 'presentation' : 'box'),
    priceCode: item.priceCode,
    packSize: item.packSize,
    clientPrice: item.price,
    specs: item.specs
  };

  if(!isCheckoutPromo(item)) return base;

  return {
    ...base,
    promoId: item.promoId || '',
    variantKey: item.variantKey || '',
    displayName: item.name,
    promoDetail: checkoutPromoDetail(item),
    promoSelection: checkoutPromoSelection(item),
    priceVisual: Number.isFinite(item.price) ? formatPrice(item.price) : 'A confirmar',
    lineTotalVisual: checkoutLinePriceVisual(item)
  };
}

function checkoutEmailPayload() {
  const totals = cartTotals();
  const name = document.getElementById('buyerName')?.value.trim() || '-';
  const phone = document.getElementById('buyerPhone')?.value.trim() || '-';
  const email = document.getElementById('buyerEmail')?.value.trim() || '-';
  const business = document.getElementById('buyerBusiness')?.value.trim() || '-';
  const address = document.getElementById('buyerAddress')?.value.trim() || '-';
  const zip = document.getElementById('deliveryZip')?.value.trim() || '-';
  const notes = document.getElementById('checkoutNotes')?.value.trim() || '-';
  return {
    _subject: `Nuevo pedido web - Mediterranea Bebidas - ${name !== '-' ? name : phone}`,
    _template: 'table',
    _captcha: 'false',
    nombre: name,
    telefono: phone,
    email,
    comercio: business,
    entrega: deliveryLabel(),
    codigo_postal: zip,
    costo_envio_estimado: shippingEstimateText(),
    direccion_o_retiro: address,
    productos: cart.map(orderLine).join('\n'),
    cart_items: cart.map(checkoutPayloadItem),
    subtotal_estimado: totals.subtotal ? formatPrice(totals.subtotal) : 'A corroborar',
    precios: totals.missing ? 'Hay productos con precio a confirmar' : 'Precios cargados en la web, sujetos a validacion final',
    medio_de_pago: 'Mercado Pago a coordinar luego de validar stock, envio y total',
    notas: notes,
    mensaje_completo: checkoutMessage()
  };
}

function setOrderEmailStatus(type, message) {
  const status = document.getElementById('orderEmailStatus');
  if(!status) return;
  status.className = `order-email-status visible ${type || ''}`.trim();
  status.textContent = message;
}

async function sendOrderEmail() {
  const response = await fetch(ORDER_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(checkoutEmailPayload())
  });
  const result = await response.json().catch(() => ({}));
  if(!response.ok || result.ok === false) {
    throw new Error(result.message || `No se pudo enviar el pedido por email (${response.status})`);
  }
  return result;
}

async function submitCheckout(event) {
  event.preventDefault();
  if(!cart.length) {
    closeCheckout();
    openCart();
    return;
  }
  const submit = document.getElementById('checkoutSubmit');
  if(submit) {
    submit.disabled = true;
    submit.textContent = 'Enviando pedido...';
  }
  setOrderEmailStatus('', `Enviando el pedido a ${ORDER_EMAIL_TO}...`);
  try {
    await sendOrderEmail();
    setOrderEmailStatus('success', `Pedido enviado a ${ORDER_EMAIL_TO}. RevisÃ¡ ese Gmail para confirmar stock, entrega y pago.`);
  } catch(error) {
    setOrderEmailStatus('error', `${error.message || 'No se pudo enviar el email automaticamente.'} Podes usar "Enviar por WhatsApp" para no perder el pedido.`);
  } finally {
    if(submit) {
      submit.disabled = false;
      submit.textContent = 'Enviar pedido por email';
    }
  }
}
