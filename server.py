#!/usr/bin/env python3
import concurrent.futures
import json
import os
import smtplib
import socket
from decimal import Decimal, ROUND_HALF_UP
from email.message import EmailMessage
from html import escape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

APP_VERSION = "resend-timeout-2026-05-21-01"
BASE_DIR = Path(__file__).resolve().parent
CATALOG_FILE = BASE_DIR / "PRODUCTOS" / "catalogo.json"
ORDER_TO = os.environ.get("MEDITERRANEA_ORDER_TO", "mediterraneabebidas60@gmail.com")
SMTP_USER = os.environ.get("MEDITERRANEA_GMAIL_USER") or os.environ.get("GMAIL_USER")
SMTP_PASSWORD = os.environ.get("MEDITERRANEA_GMAIL_APP_PASSWORD") or os.environ.get("GMAIL_APP_PASSWORD")
SMTP_HOST = os.environ.get("MEDITERRANEA_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("MEDITERRANEA_SMTP_PORT", "465"))
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
RESEND_FROM = os.environ.get("RESEND_FROM", "Mediterranea Bebidas <onboarding@resend.dev>")
socket.setdefaulttimeout(12)

PROMOTIONS = {
    "chacabuco-3x1": {
        "name": "Promo Chacabuco 3+1",
        "detail": "3 cajas pagas + 1 caja Chacabuco Cabernet Franc sin cargo",
        "type": "Promo",
        "paid_boxes": 3,
        "gift_boxes": 1,
        "gift_label": "Chacabuco Cabernet Franc",
        "variants": {
            "malbec": {"label": "Chacabuco Malbec", "price_code": "399"},
            "cabernet": {"label": "Chacabuco Cabernet", "price_code": "397"},
            "rosado": {"label": "Chacabuco Rosado", "price_code": "393"},
        },
    }
}

CHACABUCO_CHENIN_PROMOTION = {
    "id": "chacabuco-chenin",
    "name": "Chacabuco Chenin Dulce",
    "detail": "Comprando Chacabuco varietal lleva al mismo precio Chacabuco Chenin Dulce",
    "type": "Chacabuco + Chenin",
    "price_code": "394",
    "eligible_price_codes": {"399", "397", "393", "392"},
}


def money(value):
    value = Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"$ {formatted}"


def load_catalog():
    data = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    catalog = {}
    for panel in data.get("panels", []):
        for section in panel.get("sections", []):
            for product in section.get("products", []):
                price = product.get("price") or {}
                code = str(price.get("code") or "").strip()
                value = str(price.get("value") or "").strip()
                if not code or not value:
                    continue
                name = str(product.get("name") or "").strip()
                product_type = str(product.get("type") or "").strip()
                pack_size = 12 if is_tetra_product(name, product_type) else int(price.get("packSize") or 6)
                catalog[code] = {
                    "name": name,
                    "type": product_type,
                    "price": Decimal(value),
                    "pack_size": pack_size,
                }
    return catalog


def product_text(*values):
    return " ".join(str(value or "") for value in values).lower()


def is_presentation_product(product_type, name=""):
    text = product_text(product_type, name)
    return "bag in box" in text or " bib " in f" {text} " or "damajuana" in text


def is_tetra_product(name, product_type="", specs=None):
    specs = specs if isinstance(specs, dict) else {}
    text = product_text(name, product_type, specs.get("quantity"))
    return "tetrabrik" in text or "tetra brik" in text or "tetra brick" in text or "tetra" in text


def purchase_label(mode, pack_size, qty=1):
    if mode == "presentation":
        return "presentacion" if qty == 1 else "presentaciones"
    label = f"caja x{pack_size}"
    return label if qty == 1 else label.replace("caja", "cajas", 1)


def normalize_qty(value):
    try:
        qty = int(value)
    except (TypeError, ValueError):
        qty = 1
    return max(1, min(qty, 999))


def is_promo_item(raw):
    return raw.get("purchaseMode") == "promo" or bool(raw.get("promoId"))


def is_promo_addon_item(raw):
    return raw.get("purchaseMode") == "promo-addon" or bool(raw.get("addonId"))


def is_chenin_promo_item(raw):
    price_code = str(raw.get("priceCode") or "").strip()
    if is_promo_addon_item(raw):
        return False
    return (
        raw.get("purchaseMode") == "chenin-promo"
        or str(raw.get("cheninPromoId") or "").strip() == CHACABUCO_CHENIN_PROMOTION["id"]
        or price_code == CHACABUCO_CHENIN_PROMOTION["price_code"]
    )


def validate_promo_item(raw, catalog):
    promo_id = str(raw.get("promoId") or "").strip()
    variant_key = str(raw.get("variantKey") or "").strip()
    if not promo_id or not variant_key:
        raise ValueError("Promocion incompleta: faltan promoId o variantKey")

    promo = PROMOTIONS.get(promo_id)
    if not promo:
        raise ValueError(f"Promocion desconocida: {promo_id}")

    variant = promo["variants"].get(variant_key)
    if not variant:
        raise ValueError(f"Variante invalida para {promo['name']}: {variant_key}")

    catalog_item = catalog.get(variant["price_code"])
    if not catalog_item:
        raise ValueError(f"No se encontro precio oficial para {promo['name']} ({variant['label']})")

    qty = normalize_qty(raw.get("quantity"))
    paid_boxes = Decimal(promo["paid_boxes"])
    unit_price = catalog_item["price"] * paid_boxes
    line_total = unit_price * qty
    promo_qty_label = "promo 3+1" if qty == 1 else "promos 3+1"

    return {
        "name": promo["name"],
        "type": promo["type"],
        "qty": qty,
        "label": promo_qty_label,
        "mode": "promo",
        "price": f"{money(unit_price)} por promo 3+1 ({promo['paid_boxes']} cajas pagas)",
        "total": money(line_total),
        "specs": {
            "variety": variant["label"],
            "provenance": "Mendoza",
            "quantity": promo["detail"],
        },
        "code": promo_id,
        "promo_id": promo_id,
        "variant_key": variant_key,
        "subtotal": line_total,
    }


def max_chenin_promo_qty(items):
    eligible_codes = CHACABUCO_CHENIN_PROMOTION["eligible_price_codes"]
    normal_chacabuco_qty = 0
    for raw in items:
        if not isinstance(raw, dict):
            continue
        code = str(raw.get("priceCode") or "").strip()
        mode = str(raw.get("purchaseMode") or "box").strip().lower()
        if code in eligible_codes and mode == "box":
            normal_chacabuco_qty += normalize_qty(raw.get("quantity"))
    return normal_chacabuco_qty


def chenin_promo_qty_total(items):
    total = 0
    for raw in items:
        if not isinstance(raw, dict):
            continue
        if is_chenin_promo_item(raw):
            total += normalize_qty(raw.get("quantity"))
    return total


def validate_chenin_promo_item(raw, catalog, items):
    promo = CHACABUCO_CHENIN_PROMOTION
    catalog_item = catalog.get(promo["price_code"])
    if not catalog_item:
        raise ValueError(f"No se encontro precio oficial para {promo['name']}")

    qty = normalize_qty(raw.get("quantity"))
    max_qty = max_chenin_promo_qty(items)
    if max_qty <= 0:
        raise ValueError(f"{promo['name']} requiere cajas normales Chacabuco varietal")
    if chenin_promo_qty_total(items) > max_qty:
        raise ValueError(f"{promo['name']} supera el maximo permitido: {max_qty} cajas")

    unit_price = catalog_item["price"]
    line_total = unit_price * qty
    return {
        "name": promo["name"],
        "type": promo["type"],
        "qty": qty,
        "label": purchase_label("box", catalog_item.get("pack_size") or 6, qty),
        "mode": "chenin-promo",
        "price": f"{money(unit_price)} por caja x6",
        "total": money(line_total),
        "specs": {
            "variety": "Chenin Dulce",
            "provenance": "Mendoza",
            "quantity": promo["detail"],
        },
        "code": promo["price_code"],
        "chenin_promo_id": promo["id"],
        "subtotal": line_total,
    }


def validated_items(payload):
    catalog = load_catalog()
    items = payload.get("cart_items") or []
    validated = []
    subtotal = Decimal("0")
    missing = False

    for raw in items:
        if not isinstance(raw, dict):
            raise ValueError("Item de pedido invalido")
        if is_promo_item(raw):
            promo_item = validate_promo_item(raw, catalog)
            subtotal += promo_item["subtotal"]
            validated.append(promo_item)
            continue
        if is_chenin_promo_item(raw):
            chenin_item = validate_chenin_promo_item(raw, catalog, items)
            subtotal += chenin_item["subtotal"]
            validated.append(chenin_item)
            continue
        if is_promo_addon_item(raw):
            raise ValueError("Chenin ya no se acepta como addon de Promo Chacabuco 3+1")

        code = str(raw.get("priceCode") or "").strip()
        qty = normalize_qty(raw.get("quantity"))
        raw_mode = str(raw.get("purchaseMode") or "box").strip().lower()
        if raw_mode not in ("box", "presentation", "unit"):
            raise ValueError(f"Modo de compra invalido: {raw_mode}")
        catalog_item = catalog.get(code)

        if catalog_item:
            product_type = catalog_item["type"]
            name = catalog_item["name"]
            pack_size = catalog_item.get("pack_size") or 6
            is_presentation = is_presentation_product(product_type, name)
            if raw_mode == "unit" and not is_presentation:
                raise ValueError(f"No se aceptan pedidos por unidad para {name}. Selecciona caja.")
            if raw_mode == "presentation" and not is_presentation:
                raise ValueError(f"Presentacion unica no corresponde para {name}. Selecciona caja.")
            mode = "presentation" if is_presentation else "box"
            box_label = purchase_label(mode, pack_size)
            unit_price = catalog_item["price"]
            line_total = unit_price * qty
            subtotal += line_total
            price_text = f"{money(unit_price)} por {box_label}"
            total_text = money(line_total)
        else:
            missing = True
            product_type = str(raw.get("type") or "Producto")
            name = str(raw.get("name") or "Producto sin nombre")
            specs = raw.get("specs") if isinstance(raw.get("specs"), dict) else {}
            is_presentation = is_presentation_product(product_type, name)
            if raw_mode == "unit" and not is_presentation:
                raise ValueError(f"No se aceptan pedidos por unidad para {name}. Selecciona caja.")
            if raw_mode == "presentation" and not is_presentation:
                raise ValueError(f"Presentacion unica no corresponde para {name}. Selecciona caja.")
            mode = "presentation" if is_presentation else "box"
            pack_size = 12 if is_tetra_product(name, product_type, specs) else normalize_qty(raw.get("packSize") or 6)
            box_label = purchase_label(mode, pack_size)
            price_text = "Precio a confirmar"
            total_text = "A confirmar"

        specs = raw.get("specs") if isinstance(raw.get("specs"), dict) else {}
        label = purchase_label(mode, pack_size, qty)

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
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_send_email_resend_now, subject, plain, html, reply_to)
    try:
        return future.result(timeout=12)
    except concurrent.futures.TimeoutError as exc:
        future.cancel()
        raise RuntimeError("Resend no respondio dentro de 12 segundos. Revisar API key, dominio remitente o estado de Resend.") from exc
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Resend rechazo el envio: HTTP {exc.code}. {detail}") from exc
    except Exception as exc:
        raise RuntimeError(f"No se pudo conectar con Resend: {type(exc).__name__}: {exc}") from exc
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


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
