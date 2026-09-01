# Magillas Accesorios — MVP web

Tienda online para MAGILLAS ® (@magillas_accesorios, Cali). Catálogo con carrito,
categorías, personalización, despachos y asistente IA (Magui, vía DeepSeek).

## Correr

```bash
node server.js
```

Abre http://localhost:3210. Sin dependencias (Node 18+).

## Configurar (todo en `data/products.json`)

- **`config.whatsapp`**: `573165864539` (número real de la tienda).
- **`config.email`**: `accessoriesmagillas@gmail.com`
- Catálogo completo migrado desde Shopify: **224 productos**, 13 categorías, imágenes en `public/img/shop/`.

El asistente IA lee el catálogo automáticamente: al editar productos no hay que tocar nada más.

### Preview de personalización en vivo

Los productos con `"preview"` muestran el texto del cliente sobre la foto en tiempo real.
Para calibrar sobre una foto nueva: `x`/`y` = posición del centro del texto en % de la imagen,
`rot` = inclinación en grados, `size` = tamaño en % del ancho, `fonts` = tipografías elegibles.
Consejo: usar una foto del producto SIN grabado (fondo limpio) para que no se vea el grabado
original debajo del texto del cliente. `badge` en un producto pinta la etiqueta en su card.

## Claves

`.env` con `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `ADMIN_TOKEN`, y para persistencia en producción:

- `SUPABASE_URL` — URL del proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — clave **service_role** (solo servidor, nunca en el frontend)

Copia `.env.example` como base. Las tablas están en `supabase/migrations/`. Sin Supabase, en local usa JSON en `data/`.

## Pedidos y panel admin

Cada pedido se guarda en `data/orders.json` y abre WhatsApp con el resumen para confirmar. Pagos se acuerdan por WhatsApp (Nequi/transferencia/contraentrega) — no hay pasarela todavía.

**Panel admin en `/admin.html`** (token = `ADMIN_TOKEN` del `.env`): cambiar estado del pedido
(recibido → confirmado → elaborando → enviado → entregado), poner número de guía y transportadora
(el cliente lo ve en "Rastrear pedido"), ver suscriptores del boletín y borrar reseñas.

Ver `MEJORAS.md` para el log completo de mejoras por jornada y lo pendiente.

## Siguiente nivel (cuando el MVP lo pida)

- Pasarela de pagos (Wompi/MercadoPago) en vez de cierre por WhatsApp.
- Subida de foto de personalización directa en el sitio.
- Panel admin para productos/pedidos (hoy: editar JSON).
- Deploy (Vercel/Cloudflare/VPS) + dominio magillasaccesorios.com (hoy apunta al Shopify suspendido — HTTP 402 por falta de pago; si quieren reactivar Shopify es por facturación de Shopify).
