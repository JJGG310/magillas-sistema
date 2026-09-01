# Log de jornadas de mejora — Magillas Web

Ciclo: investigación → ejecución → validación. Registro de qué se hizo y qué queda.

## J1 — Infraestructura de recomendaciones ✅
- Reseñas por producto (API + estrellas en cards/modal + formulario). Moderación desde /admin.html.
- Newsletter con cupón de bienvenida (BIENVENIDA10, configurable en products.json → config.cupones).
- Cupones en el carrito (validación + descuento en totales y pedido).
- Rastreo de pedido (código + celular) en el footer.
- Guía de tallas (modal en pulseras).
- Modo regalo en checkout (tarjeta a mano, sin precios, destinatario).
- Soporte precioAntes (precio tachado) — sin datos hasta que haya ofertas reales.
- Validado: APIs, XSS escapado en reseñas, cupón −10% correcto, tracking E2E.

## J2 — SEO, FAQ, chat y accesibilidad ✅
- JSON-LD: OnlineStore + ItemList (productos) + FAQPage. OG/Twitter tags. Canonical.
- Sección FAQ (6 preguntas: materiales, cuidado, personalización, tiempos, garantía, pago).
- Chat: quick-replies, sugerencias de producto clicables, conversación persistente (sesión).
- Menú hamburguesa móvil, targets táctiles ≥44px, focus-visible, prefers-reduced-motion, contraste AA (dorado-texto).
- Stock bajo honesto: pon "stock": N en un producto y muestra "¡Quedan N!" solo si N ≤ 3.
- Validado: schemas presentes, menú móvil, quick chips → respuesta de Magui.

## J3 — Conocimiento de Magui + panel admin ✅
- Magui ahora conoce: preview en vivo del sitio, políticas del FAQ (garantía 5 días, cuidado,
  tallas), rastreo, y guía al boletín si preguntan por descuentos (sin regalar códigos).
- /admin.html: pedidos (estado + guía + transportadora → alimenta el rastreo del cliente),
  suscriptores, borrar reseñas. Token en .env (ADMIN_TOKEN).
- Performance: fetchpriority hero, width/height anti-CLS.
- Validado: 401 sin token, PATCH → tracking refleja cambio, Magui responde políticas exactas.

## J4 — Links compartibles + cross-sell ✅
- /p/<id>: página por producto con OG tags propios (previews bonitos al compartir por WhatsApp/IG)
  que abre el producto automáticamente. Botón "Compartir" (Web Share / copiar link).
- "Combínalo con": cross-sell en el modal (misma categoría).
- sitemap.xml + robots.txt (admin y api bloqueados).
- "Seguir comprando" en carrito vacío.
- Fix: rutas de assets absolutas (los links /p/... rompían CSS/JS con rutas relativas).
- Validado: OG por producto, redirect de id inexistente, modal auto-abierto, cero 404.

## J5 — Auditoría de seguridad (revisión de código independiente) ✅
- Pedidos: el servidor ahora RECALCULA precios, descuento, envío y total desde el catálogo
  (el cliente ya no puede falsificar totales, estado ni id del pedido). Qty limitada 1–99,
  campos truncados, producto inexistente rechazado.
- XSS corregido en el carrito (personalizaciones escapadas).
- Cupón/envío: barra de progreso y selector usan el subtotal CON descuento (consistente).
- WhatsApp usa el total autoritativo del servidor.
- Validado con requests de ataque: id/estado/precio falsos ignorados, XSS inerte.

## J6 — Polish visual + PWA-lite ✅
- Reveal suave de secciones al hacer scroll (con listener robusto, no solo IntersectionObserver;
  respetando prefers-reduced-motion).
- Zoom en la imagen del modal (clic para acercar; desactivado en productos con preview).
- manifest.json + theme-color (instalable como app).

## J7 — Chat en streaming ✅
- Magui responde token a token en vivo (proxy streaming del servidor, cero dependencias).
- Regla de texto plano (sin markdown) en el prompt.
- Validado: burbuja progresiva + sugerencias de producto al final.

## J8-J9 — Regresión final ✅
- Sintaxis server OK; rutas /, /admin.html, /p/<id>, manifest → 200.
- Pedido E2E completo (personalización + tipografía + regalo): total server-side correcto.
- Datos de prueba limpiados (orders/reviews/newsletter en []).

## J10 — Auditoría completa frontend + backend ✅

**Bug reportado por Juan**: el nav chocaba con el logo entre ~900-1080px. Causa: nav sin
`white-space: nowrap`, logo sin `flex-shrink: 0`, y el breakpoint del hamburguesa en 820px
cuando el nav horizontal necesita ~1050px. Corregido y verificado a 1000/1100/1280px y móvil.

**Backend (3 críticos corregidos):**
- PÉRDIDA DE DATOS: si un .json se corrompía, la siguiente escritura borraba todo el historial
  de pedidos. Ahora: lectura marca el archivo como corrupto y BLOQUEA la escritura; escritura
  con respaldo .bak + atómica (tmp+rename).
- `/api/chat` era un proxy abierto a la key de DeepSeek (cualquiera podía gastarla). Ahora
  rate limit por IP: chat 12/5min, pedidos 10/10min, reseñas 3/30min, boletín 5/30min, admin 30/5min.
- Un stream de chat fallido tumbaba TODO el proceso (doble writeHead → rechazo no atrapado).
  Ahora try/catch que respeta headersSent + timeout de 45s + aborta si el cliente cierra.
- Además: catálogo con caché (sobrevive a products.json roto), token admin con `timingSafeEqual`,
  cupón `__proto__` ya no da NaN, JSON inválido → 400, estados de pedido validados contra enum,
  rastreo exige ≥4 dígitos, errores logueados, `/health`, SIGTERM/SIGINT, uncaughtException,
  cache 7 días para imágenes, `.gitignore`.

**Frontend (bugs corregidos):**
- El botón "Confirmar pedido" podía quedar fuera de alcance en pantallas bajas (el pie del
  drawer no scrolleaba).
- Sin estado de carga → esqueletos animados; sin estado de error → mensaje + reintentar;
  filtro sin resultados → mensaje.
- El scroll del fondo seguía activo con modal abierto.
- El preview de personalización se desbordaba de la joya con texto largo → ahora se auto-encoge.
- El `<br>` fijo del H1 producía 3 líneas desparejas → `text-wrap: balance`.
- Anclas tapadas por el header sticky → `scroll-margin-top`.

**Transiciones añadidas (12):** modal con scale+fade (entrada y salida, `@starting-style`),
drawer deslizante en ambos sentidos, cards escalonadas al entrar, zoom en hover de card,
"salto" del contador del carrito, botón "✓ Añadido" en el punto del clic, chat que crece desde
su botón, burbujas de chat que aparecen, acordeón FAQ animado (`::details-content`), botones
que responden al toque, sugerencias que se desplazan en hover, preview que asienta al escribir.
Todo respeta `prefers-reduced-motion`.

**Accesibilidad:** foco atrapado en diálogos + devuelto al cerrar, `aria-label` en cerrar,
`aria-pressed` en filtros y tipografías, 3 regiones `aria-live`, botones que se deshabilitan
mientras envían (reseña, boletín, rastreo).

## Pendiente / requiere decisión de negocio
- Número real de WhatsApp (config.whatsapp) y precios reales.
- Confirmar tiempos de producción (puse 3–5 días hábiles) y política de garantía (5 días).
- Segunda foto por producto (hover) y fotos limpias sin grabado para el preview.
- Pasarela de pagos (Wompi/MercadoPago) — hoy el cierre es por WhatsApp.
- Email real para newsletter (hoy solo captura; falta conectar Mailchimp/Brevo o similar).
- Deploy + dominio (magillasaccesorios.com apunta al Shopify suspendido).

## J11 — Revisión post-Cursor y arreglos en producción ✅ (28 ago 2026)

Revisión del trabajo hecho en Cursor (224 productos migrados de Shopify, Supabase,
Wompi, blog, páginas mayorista/militar/padre, CSRF por origen, moderación de reseñas).

**Arreglado y desplegado a producción:**

1. **El carrito quedaba fuera de la pantalla en desktop.** El nav creció de 5 a 15 items
   (9 categorías + 6 enlaces) y desbordaba 506px a 1280px — el botón del carrito caía en
   x=1746, invisible e inalcanzable. A 1920px seguía afuera (x=2065). Móvil estaba bien.
   Solución: la barra muestra 4 categorías de mayor volumen (Ofertas, Personalizables,
   Collares, Pulseras neopreno) + "Ver todo" + un desplegable **"Más ▾"** con las 13
   restantes. En móvil el desplegable se abre en línea dentro del hamburguesa.
   Verificado a 375 / 1100 / 1280 / 1920: desborde 0 y carrito visible en todos.

2. **5 productos con el descuento invertido** (precio tachado MENOR que el actual, o sea
   parecía subida de precio): Anillos personalizados, Camandula premium, collar barra,
   Pulsera esclava, Pulsera barca. Se les quitó el `precioAntes` erróneo de la migración
   de Shopify — no se inventó un precio "antes". Las 32 ofertas legítimas quedaron intactas.

**Revisado y correcto (sin tocar):** cupón BIENVENIDA10 (funciona), Magui con precios
reales, Supabase con RLS + RPC sin filtrar el secreto al navegador, Wompi apagado pero
bien manejado (no muestra el botón), 1 solo error en 7 días, lo desplegado == lo local.

**Pendiente de decisión de Juan:**
- **El dominio sigue en Shopify** (23.227.38.65) y esa tienda está VIVA vendiendo. Todo el
  tráfico de Instagram va a la vieja; la nueva no tiene ventas reales. Ver DNS.md.
- `ADMIN_TOKEN` sirve a la vez de clave del panel y de secreto de los RPC de Supabase: si
  se filtra, se pueden leer todos los pedidos con datos de clientes saltándose el rate
  limit. Mejor usar `SUPABASE_SERVICE_ROLE_KEY` (opción A del propio .env.example).
- Wompi: falta registrarse y poner `WOMPI_PRIVATE_KEY` para activar pagos en línea.
- README desactualizado (dice que no hay pasarela ni deploy, y ambos ya existen).

## J12 — Panel de administración en subdominio aparte ✅

Antes solo se podían editar pedidos y reseñas: el catálogo y las fotos eran archivos
del proyecto y en Vercel el disco es de **solo lectura**. Para poder editarlos hubo
que mover el catálogo a la base de datos.

**Base (Supabase)**
- `magillas_products` (224 productos migrados) y `magillas_content` (19 bloques de textos
  y ajustes del sitio), con RLS: lectura pública, escritura solo para administradores.
- `magillas_admins` como lista blanca: tener cuenta NO da permisos, y nadie puede
  autopromoverse. Verificado con pruebas de intrusión (anónimo y usuario registrado
  sin permisos: no pueden cambiar precios, borrar productos ni tocar el WhatsApp).
- Bucket `magillas-catalogo` para fotos de producto (5 MB, solo admins suben).
- `scripts/crear-admin.py` para dar de alta administradores sin que la contraseña
  pase por ningún archivo.

**Tienda**
- `lib/catalogo-remoto.js`: lee el catálogo de Supabase con caché de 60 s y **respaldo
  automático** al `products.json` si Supabase falla — la tienda nunca se queda sin catálogo.
- `/health` ahora dice de dónde sale el catálogo (`supabase` o `archivo`).

**Panel** (carpeta `magillas-admin/`, proyecto de Vercel independiente)
- Login con Supabase Auth (correo + contraseña + recuperación). Sin servidor propio.
- Productos: buscar, filtrar, crear, editar, ocultar, eliminar; fotos con arrastrar y
  soltar, elegir la principal. Valida que el "precio antes" sea mayor que el actual
  (el error que corregimos en J11 ya no se puede volver a cometer desde el panel).
- Contenido: 19 bloques editables (envíos, cupones, beneficios, políticas, categorías…).
- `noindex` + robots.txt bloqueado; nunca se sirve desde el dominio de la tienda.

**Pendiente:** apuntar `admin.magillasaccesorios.com` al panel (un CNAME, no toca el correo).
