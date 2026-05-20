# Subir Mediterranea Bebidas

Esta web necesita backend porque los pedidos se envian por email y el total se recalcula en servidor.

## Opcion recomendada: Render

1. Crea una cuenta en https://render.com
2. Sube esta carpeta a un repositorio de GitHub.
3. En Render: New > Web Service.
4. Conecta el repositorio.
5. Configura:
   - Runtime: Python
   - Build command: `pip install -r requirements.txt`
   - Start command: `python server.py`
6. Variables de entorno recomendadas:
   - `RESEND_API_KEY` = API key de Resend
   - `RESEND_FROM` = `Mediterranea Bebidas <onboarding@resend.dev>` al principio, o un remitente de dominio verificado
   - `MEDITERRANEA_ORDER_TO` = `mediterraneabebidas60@gmail.com`
7. Deploy.

Render asigna automaticamente la variable `PORT`; `server.py` ya esta preparado para usarla.

## Email

En Render Free se recomienda Resend porque usa HTTPS y no depende de SMTP. Gmail SMTP queda como fallback local con:

- `MEDITERRANEA_GMAIL_USER`
- `MEDITERRANEA_GMAIL_APP_PASSWORD`

## Dominio

Cuando Render te de una URL publica, podes conectar un dominio propio desde la configuracion del servicio.

## Seguridad

- No subas API keys ni contrasenas a GitHub.
- Guardalas solo como variables de entorno del hosting.
- El HTML no tiene credenciales.
- El total se recalcula en `server.py` con los precios de `index.html`.
