# Panel de administración — MAGILLAS ®

Panel para editar el catálogo y los textos de la tienda sin tocar código.
Vive **aparte** de la tienda: proyecto de Vercel propio y subdominio propio.

- **Panel:** https://magillas-admin.vercel.app (luego: `admin.magillasaccesorios.com`)
- **Tienda:** https://magillas-web.vercel.app

## Cómo funciona

Es una página estática: no tiene servidor propio. Habla directo con Supabase
(Auth para el login, la base para el catálogo, Storage para las fotos).

La seguridad la da **RLS** en la base, no el panel:

- Cualquiera puede **leer** el catálogo (es público, la tienda lo necesita).
- Para **escribir** hay que tener sesión iniciada **y** estar en la tabla `magillas_admins`.
- Estar registrado no basta: nadie puede autopromoverse a administrador.

Probado: un anónimo y un usuario registrado sin permisos no pueden cambiar precios,
borrar productos ni tocar el WhatsApp de la tienda.

## Crear el primer administrador

Desde la carpeta `magillas-web`:

```bash
python3 scripts/crear-admin.py
```

Pide correo y contraseña. La contraseña no se guarda en ningún archivo ni se
muestra: va directo a Supabase. Para agregar otra persona, se corre otra vez.

## Qué se puede editar

**Productos** — nombre, categoría, precio, precio anterior (ofertas), stock,
descripción, etiqueta, destacado, visible/oculto, y las fotos (subir, borrar,
elegir la principal). También crear y eliminar productos.

**Contenido del sitio** — WhatsApp, correo, envíos y costos, envío gratis desde,
cupones, beneficios, políticas, categorías, ocasiones, redes, Addi, analítica y
los textos de mayoristas.

Los cambios aparecen en la tienda en **menos de un minuto** (la tienda cachea el
catálogo 60 segundos para ir rápido).

## Detalles que conviene saber

- **Ocultar vs eliminar:** desmarcar "Visible en la tienda" lo saca de la web pero
  conserva el producto. "Eliminar" lo borra de verdad.
- **Precio anterior:** solo se acepta si es mayor que el precio actual. Si no, la
  web mostraría que subiste el precio en vez de una oferta.
- **Fotos nuevas:** van a Supabase Storage (máx 5 MB). Las viejas siguen sirviéndose
  desde la tienda; al reemplazar una, la nueva queda en Supabase.
- **Personalización:** los productos con vista previa (el texto sobre la joya)
  conservan su configuración al guardar desde el panel. Ajustar la posición del
  grabado sigue siendo cosa de código.

## Si algo falla

La tienda **no depende del panel**. Si Supabase se cae, la tienda sigue vendiendo
con el catálogo del archivo (`data/products.json`). Se ve en `/health`:
`"catalogo":"supabase"` o `"catalogo":"archivo"`.

## Volver a desplegar

```bash
npx vercel --prod --scope jjgg310s-projects
```
