#!/usr/bin/env python3
import json
import os
import re
import smtplib
import socket
from decimal import Decimal, ROUND_HALF_UP
from email.message import EmailMessage
from html import escape, unescape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

APP_VERSION = "catalog-tabs-magnum-2026-05-23-01"
BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "index.html"
ORDER_TO = os.environ.get("MEDITERRANEA_ORDER_TO", "mediterraneabebidas60@gmail.com")
SMTP_USER = os.environ.get("MEDITERRANEA_GMAIL_USER") or os.environ.get("GMAIL_USER")
SMTP_PASSWORD = os.environ.get("MEDITERRANEA_GMAIL_APP_PASSWORD") or os.environ.get("GMAIL_APP_PASSWORD")
SMTP_HOST = os.environ.get("MEDITERRANEA_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("MEDITERRANEA_SMTP_PORT", "465"))
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM = os.environ.get("RESEND_FROM", "Mediterranea Bebidas <onboarding@resend.dev>")
socket.setdefaulttimeout(12)
CATALOG_CACHE = None


def money(value):
    value = Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"$ {formatted}"


def load_catalog():
    global CATALOG_CACHE
    if CATALOG_CACHE is not None:
        return CATALOG_CACHE

    html = INDEX_FILE.read_text(encoding="utf-8")
    card_pattern = re.compile(
        r'<div class="wine-card">.*?'
        r'<div class="wine-type-badge[^"]*">(?P<type>.*?)</div>.*?'
        r'<div class="wine-name">(?P<name>.*?)</div>.*?'
        r'<div class="wine-price"[^>]*data-price="(?P<price>[^"]+)"[^>]*data-price-code="(?P<code>[^"]+)"'
    )
    catalog = {}
    for line in html.splitlines():
        if '<div class="wine-card">' not in line or "data-price-code" not in line:
            continue
        match = card_pattern.search(line)
        if not match:
            continue
        code = unescape(match.group("code")).strip()
        box_match = re.search(r'data-box-size="(?P<size>\d+)"', line)
        unit_match = re.search(r'data-unit-price="(?P<price>[^"]+)"', line)
        catalog[code] = {
            "name": unescape(re.sub(r"<.*?>", "", match.group("name"))).strip(),
            "type": unescape(re.sub(r"<.*?>", "", match.group("type"))).strip(),
            "price": Decimal(match.group("price")),
            "box_size": Decimal(box_match.group("size")) if box_match else Decimal("6"),
            "unit_price": Decimal(unit_match.group("price")) if unit_match else None,
        }
    CATALOG_CACHE = catalog
    return CATALOG_CACHE


def is_unit_product(product_type):
    text = str(product_type or "").lower()
    return "bag in box" in text or "damajuana" in text


def normalize_qty(value):
    try:
        qty = int(value)
    except (TypeError, ValueError):
        qty = 1
    return max(1, min(qty, 999))


def validated_items(payload):
    items = payload.get("cart_items") or []
    if not items:
        return [], Decimal("0"), False

    catalog = load_catalog()
    validated = []
    subtotal = Decimal("0")
    missing = False

    for raw in items:
        code = str(raw.get("priceCode") or "").strip()
        qty = normalize_qty(raw.get("quantity"))
        mode = "unit" if raw.get("purchaseMode") == "unit" else "box"
        catalog_item = catalog.get(code)

        if catalog_item:
            product_type = catalog_item["type"]
            name = catalog_item["name"]
            if is_unit_product(product_type):
                mode = "unit"
            box_size = catalog_item.get("box_size") or Decimal("6")
            explicit_unit_price = catalog_item.get("unit_price")
            box_label = f"caja x{int(box_size)}"
            unit_price = (
                explicit_unit_price or (catalog_item["price"] / box_size)
            ) if mode == "unit" and not is_unit_product(product_type) else catalog_item["price"]
            line_total = unit_price * qty
            subtotal += line_total
            price_text = f"{money(unit_price)} por {'unidad' if mode == 'unit' else box_label}"
            total_text = money(line_total)
        else:
            missing = True
            product_type = str(raw.get("type") or "Producto")
            name = str(raw.get("name") or "Producto sin nombre")
            price_text = "Precio a confirmar"
            total_text = "A confirmar"
            box_label = f"caja x{normalize_qty(raw.get('boxSize') or 6)}"

        specs = raw.get("specs") if isinstance(raw.get("specs"), dict) else {}
        label = "unidad" if mode == "unit" else box_label
        if qty != 1:
            label = "unidades" if mode == "unit" else box_label.replace("caja", "cajas", 1)

        validated.append({
            "name": name,
            "type": product_type,
            "qty": qty,
            "label": label,
            "mode": mode,
            "price": price_text,
            "total": total_text,
            "specs": specs,
            "code": code or "-",
        })

    return validated, subtotal, missing


def text_value(payload, key, default="-"):
    value = payload.get(key, default)
    if value is None:
        return default
    value = str(value).strip()
    return value or default


def build_email(payload):
    items, subtotal, missing = validated_items(payload)
    name = text_value(payload, "nombre")
    phone = text_value(payload, "telefono")
    buyer_email = text_value(payload, "email")
    business = text_value(payload, "comercio")
    delivery = text_value(payload, "entrega")
    zip_code = text_value(payload, "codigo_postal")
    shipping_cost = text_value(payload, "costo_envio_estimado")
    address = text_value(payload, "direccion_o_retiro")
    payment_status = text_value(payload, "pago_confirmado_cliente", "No")
    mp_alias = text_value(payload, "alias_mercado_pago", "bruno.laforte")
    notes = text_value(payload, "notas")

    subject = f"Nuevo pedido web - Mediterranea Bebidas - {name if name != '-' else phone}"
    subtotal_text = money(subtotal) if subtotal else "A corroborar"
    if missing:
        subtotal_text += " (hay productos con precio a confirmar)"

    item_lines = []
    item_rows = []
    for item in items:
        specs = item["specs"]
        spec_text = "; ".join(
            f"{label}: {specs.get(key, '-')}"
            for label, key in (("Variedad", "variety"), ("Procedencia", "provenance"), ("Cantidad", "quantity"))
            if specs.get(key)
        )
        item_lines.append(f"- {item['qty']} {item['label']} de {item['name']} ({spec_text}) - {item['total']}")
        item_rows.append(
            "<tr>"
            f"<td>{escape(item['name'])}</td>"
            f"<td>{escape(item['type'])}</td>"
            f"<td>{escape(str(item['qty']))} {escape(item['label'])}</td>"
            f"<td>{escape(spec_text or '-')}</td>"
            f"<td>{escape(item['price'])}</td>"
            f"<td>{escape(item['total'])}</td>"
            "</tr>"
        )

    plain = "\n".join([
        "Nuevo pedido web - Mediterranea Bebidas",
        "",
        "PRODUCTOS",
        *item_lines,
        "",
        f"TOTAL ESTIMADO: {subtotal_text}",
        "",
        "DATOS DEL CLIENTE",
        f"Nombre: {name}",
        f"Telefono: {phone}",
        f"Email: {buyer_email}",
        f"Comercio: {business}",
        f"Entrega: {delivery}",
        f"Codigo postal: {zip_code}",
        f"Costo envio estimado: {shipping_cost}",
        f"Direccion/retiro: {address}",
        f"Pago confirmado por cliente: {payment_status}",
        f"Alias Mercado Pago: {mp_alias}",
        f"Notas: {notes}",
        "",
        "El total fue recalculado por el servidor desde la lista cargada en la web. Confirmar stock, envio e impuestos antes del pago.",
    ])

    html = f"""
    <h2>Nuevo pedido web - Mediterranea Bebidas</h2>
    <h3>Productos</h3>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;">
      <thead><tr><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Detalle</th><th>Precio</th><th>Total</th></tr></thead>
      <tbody>{''.join(item_rows)}</tbody>
    </table>
    <h3>Total estimado: {escape(subtotal_text)}</h3>
    <h3>Datos del cliente</h3>
    <p><strong>Nombre:</strong> {escape(name)}<br>
    <strong>Telefono:</strong> {escape(phone)}<br>
    <strong>Email:</strong> {escape(buyer_email)}<br>
    <strong>Comercio:</strong> {escape(business)}<br>
    <strong>Entrega:</strong> {escape(delivery)}<br>
    <strong>Codigo postal:</strong> {escape(zip_code)}<br>
    <strong>Costo envio estimado:</strong> {escape(shipping_cost)}<br>
    <strong>Direccion/retiro:</strong> {escape(address)}<br>
    <strong>Pago confirmado por cliente:</strong> {escape(payment_status)}<br>
    <strong>Alias Mercado Pago:</strong> {escape(mp_alias)}<br>
    <strong>Notas:</strong> {escape(notes)}</p>
    <p>El total fue recalculado por el servidor desde la lista cargada en la web. Confirmar stock, envio e impuestos antes del pago.</p>
    """
    return subject, plain, html, buyer_email


def _send_email_resend_now(subject, plain, html, reply_to):
    body = {
        "from": RESEND_FROM,
        "to": [ORDER_TO],
        "subject": subject,
        "text": plain,
        "html": html,
    }
    if reply_to and reply_to != "-":
        body["reply_to"] = reply_to

    request = Request(
        "https://api.resend.com/emails",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "MediterraneaBebidas/1.0",
            "Connection": "close",
        },
        method="POST",
    )
    with urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8") or "{}")


def send_email_resend(subject, plain, html, reply_to):
    try:
        return _send_email_resend_now(subject, plain, html, reply_to)
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Resend rechazo el envio: HTTP {exc.code}. {detail}") from exc
    except Exception as exc:
        raise RuntimeError(f"No se pudo conectar con Resend: {type(exc).__name__}: {exc}") from exc


def send_email_smtp(subject, plain, html, reply_to):
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError(
            "Faltan credenciales de email. Configura RESEND_API_KEY en Render, o MEDITERRANEA_GMAIL_USER y MEDITERRANEA_GMAIL_APP_PASSWORD para SMTP local."
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = ORDER_TO
    if reply_to and reply_to != "-":
        msg["Reply-To"] = reply_to
    msg.set_content(plain)
    msg.add_alternative(html, subtype="html")

    errors = []
    smtp_attempts = [
        ("ssl", SMTP_HOST, SMTP_PORT),
        ("starttls", SMTP_HOST, 587),
    ]
    for mode, host, port in smtp_attempts:
        try:
            if mode == "ssl":
                with smtplib.SMTP_SSL(host, port, timeout=12) as smtp:
                    smtp.login(SMTP_USER, SMTP_PASSWORD)
                    smtp.send_message(msg)
                    return
            with smtplib.SMTP(host, port, timeout=12) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                smtp.login(SMTP_USER, SMTP_PASSWORD)
                smtp.send_message(msg)
                return
        except Exception as exc:
            errors.append(f"{host}:{port} {mode} -> {exc}")
    raise RuntimeError("No se pudo conectar con Gmail SMTP. " + " | ".join(errors))


def email_config_status():
    if RESEND_API_KEY:
        provider = "resend"
    elif SMTP_USER and SMTP_PASSWORD:
        provider = "smtp"
    else:
        provider = "missing"
    return {
        "ok": True,
        "app_version": APP_VERSION,
        "email_provider": provider,
        "has_resend_api_key": bool(RESEND_API_KEY),
        "has_smtp_credentials": bool(SMTP_USER and SMTP_PASSWORD),
        "order_to": ORDER_TO,
        "resend_from": RESEND_FROM,
    }


def send_email(payload):
    subject, plain, html, reply_to = build_email(payload)
    if RESEND_API_KEY:
        return send_email_resend(subject, plain, html, reply_to)
    if os.environ.get("RENDER") or os.environ.get("RENDER_SERVICE_ID"):
        raise RuntimeError("Falta RESEND_API_KEY en Render. SMTP/Gmail no se usa en Render Free porque esos puertos estan bloqueados.")
    return send_email_smtp(subject, plain, html, reply_to)


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/api/health":
            self.respond_json(200, email_config_status())
            return
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/orders":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 1_000_000:
                raise ValueError("Pedido vacio o demasiado grande")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if str(payload.get("pago_confirmado_cliente", "")).strip().lower() not in {"si", "sí", "true", "1"}:
                raise ValueError("El pedido por email solo se envia despues de confirmar el pago por Mercado Pago. Usa WhatsApp para pedidos sin pago.")
            send_email(payload)
            self.respond_json(200, {"ok": True, "message": "Pedido enviado por email."})
        except Exception as exc:
            error_text = str(exc).lower()
            status = 503 if "credenciales" in error_text or "resend" in error_text or "smtp" in error_text else 400
            self.respond_json(status, {"ok": False, "message": str(exc)})

    def respond_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    host = os.environ.get("MEDITERRANEA_HOST")
    port_value = os.environ.get("PORT") or os.environ.get("MEDITERRANEA_PORT") or "8765"
    if not host:
        host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    port = int(port_value)
    print(f"Mediterranea Bebidas server: http://{host}:{port}")
    print(f"Pedidos a: {ORDER_TO}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
