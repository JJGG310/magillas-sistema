# DNS — magillasaccesorios.com

Los dos dominios ya están **registrados en Vercel**. Solo falta crear los registros
en el panel DNS del registrador (Google Domains / Squarespace).

| Destino | Estado en Vercel | Falta |
|---------|------------------|-------|
| `magillasaccesorios.com` → tienda | ✅ agregado a `magillas-web` | el registro DNS |
| `www.magillasaccesorios.com` → tienda | ✅ agregado a `magillas-web` | el registro DNS |
| `admin.magillasaccesorios.com` → panel | ✅ agregado a `magillas-admin` | el registro DNS |

## ⚠️ NO cambies los nameservers

El dominio **tiene correo configurado** (MX en `hostedemail.com` + SPF + DMARC).
Si mueves los nameservers a Vercel, esos registros desaparecen y **se rompe el correo**.
Los registros de abajo solo tocan lo necesario.

## Registros a crear

### Para el panel de administración (se puede hacer ya, no afecta la tienda)

| Tipo | Nombre | Valor |
|------|--------|-------|
| **CNAME** | `admin` | `cname.vercel-dns.com` |

*(Si tu panel no acepta CNAME ahí, sirve igual: `A` `admin` → `76.76.21.21`.)*

Esto es independiente del resto: no toca la tienda ni el correo.

### Para la tienda (cuando decidas dejar Shopify)

| Tipo | Nombre | Cambiar de | A esto |
|------|--------|-----------|--------|
| **A** | `@` | `23.227.38.65` (Shopify) | **`76.76.21.21`** |
| **CNAME** | `www` | `shops.myshopify.com` | **`cname.vercel-dns.com`** |

## Los que NO se tocan nunca (correo)

| Tipo | Valor |
|------|-------|
| MX | `1 mx.magillasaccesorios.com.cust.b.hostedemail.com.` |
| TXT | `v=spf1 include:_spf.hostedemail.com ~all` |
| TXT `_dmarc` | `v=DMARC1; p=none` |

## Verificar (5–30 min después)

```bash
dig +short admin.magillasaccesorios.com && curl -s -o /dev/null -w "panel: %{http_code}\n" https://admin.magillasaccesorios.com && dig +short magillasaccesorios.com MX
```

El panel debe responder `200`, y los MX deben seguir apareciendo. El certificado
HTTPS lo emite Vercel solo, no hay que hacer nada.

Para la tienda, cuando la migres:

```bash
curl -s https://magillasaccesorios.com/health
# esperado: {"ok":true,...,"store":"supabase","catalogo":"supabase"}
```

## Ojo con Shopify (solo aplica al cambio de la tienda)

`magillasaccesorios.com` hoy muestra la tienda Shopify, que **está viva y vendiendo**.
Al cambiar el registro A deja de recibir tráfico:

- Los enlaces de estado de pedido de Shopify que ya tengan clientes dejarán de funcionar.
- Exporta pedidos y clientes de Shopify **antes** de cancelar el plan.
- Si la suscripción sigue activa, la pagarás sin usarla: decide si la cancelas.

## Si algo sale mal

Volver atrás es inmediato: el registro A del `@` de nuevo en `23.227.38.65` y el
CNAME de `www` en `shops.myshopify.com`.
