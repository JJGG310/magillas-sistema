# Magillas — sistema completo

Repo: https://github.com/JJGG310/magillas-sistema

Tienda online de MAGILLAS ® (accesorios personalizados, Cali) y su panel de
administración. Dos proyectos, un solo sistema:

| Carpeta | Qué es | Desplegado en |
|---|---|---|
| [`magillas-web/`](magillas-web/) | La tienda: catálogo, carrito, checkout por WhatsApp, asistente IA, blog | Vercel — `magillasaccesorios.com` |
| [`magillas-admin/`](magillas-admin/) | Panel para editar productos, fotos y contenido sin tocar código | Vercel — `admin.magillasaccesorios.com` |

Cada carpeta tiene su propio `README.md` con el detalle. El historial completo
de decisiones y mejoras está en [`magillas-web/MEJORAS.md`](magillas-web/MEJORAS.md).

## Cómo encajan

- **Base de datos:** Supabase (catálogo, contenido del sitio, pedidos, reseñas).
- **La tienda** lee el catálogo de Supabase con caché de 60s y **respaldo automático**
  al `data/products.json` del propio proyecto si Supabase llega a fallar.
- **El panel** solo escribe: no tiene servidor propio, habla directo con Supabase
  (Auth para el login, REST para los datos, Storage para las fotos). La seguridad
  la da RLS en la base — no el código del panel.
- Los dos proyectos son independientes en Vercel: si el panel falla, la tienda
  sigue vendiendo.

## Desarrollo local

```bash
cd magillas-web && node server.js        # tienda en localhost:3210
cd magillas-admin && python3 -m http.server 3211   # panel en localhost:3211
```

Cada carpeta necesita su configuración (`magillas-web/.env` desde
`.env.example`; `magillas-admin/config.js` con las claves públicas de Supabase).
