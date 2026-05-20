# Subir Mediterranea Bebidas

Esta web necesita backend porque los pedidos se envian por Gmail y el total se recalcula en servidor.

## Opcion recomendada: Render

1. Crea una cuenta en https://render.com
2. Sube esta carpeta a un repositorio de GitHub.
3. En Render: New > Web Service.
4. Conecta el repositorio.
5. Configura:
   - Runtime: Python
   - Build command: `pip install -r requirements.txt`
   - Start command: `python server.py`
6. Variables de entorno:
   - `MEDITERRANEA_GMAIL_USER` = `mediterraneabebidas60@gmail.com`
   - `MEDITERRANEA_GMAIL_APP_PASSWORD` = contraseña de aplicacion de Google
   - `MEDITERRANEA_ORDER_TO` = `mediterraneabebidas60@gmail.com`
7. Deploy.

Render asigna automaticamente la variable `PORT`; `server.py` ya esta preparado para usarla.

## Dominio

Cuando Render te de una URL publica, podes conectar un dominio propio desde la configuracion del servicio.

## Seguridad

- No subas la contraseña de aplicacion a GitHub.
- Guardala solo como variable de entorno del hosting.
- El HTML no tiene credenciales.
- El total se recalcula en `server.py` con los precios de `index.html`.
