var WHATSAPP_NUMBER = '5493512114069';
var WHATSAPP_DEFAULT_TEXT = 'Hola Mediterranea Bebidas, quiero hacer un pedido.';
var ORDER_EMAIL_TO = 'mediterraneabebidas60@gmail.com';
var ORDER_EMAIL_ENDPOINT = '/api/orders';
var CATALOG_URL = 'PRODUCTOS/catalogo.json';

function whatsAppUrl(message = WHATSAPP_DEFAULT_TEXT) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
