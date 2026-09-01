// Construcción de pedidos (compartido: WhatsApp y Wompi)
const { subirFotoPedido } = require('./storage');

async function construirPedido(p, { catalogo, store, ENV, estado = 'recibido' }) {
  if (!p.nombre || !p.telefono || !Array.isArray(p.items) || !p.items.length) {
    return { error: 'nombre, telefono e items son obligatorios' };
  }
  const c = catalogo();
  const qtyPorId = {};
  for (const it of p.items) {
    const prod = c.productos.find(x => x.id === it.id);
    if (!prod) return { error: `producto desconocido: ${String(it.id).slice(0, 40)}` };
    const qty = Math.min(99, Math.max(1, Math.round(Number(it.qty) || 1)));
    qtyPorId[prod.id] = (qtyPorId[prod.id] || 0) + qty;
  }
  for (const [id, totalQty] of Object.entries(qtyPorId)) {
    const prod = c.productos.find(x => x.id === id);
    if (prod.stock === 0) return { error: `${prod.nombre} está agotado` };
    const stockMax = prod.stock != null ? prod.stock : 99;
    if (totalQty > stockMax) {
      return { error: `${prod.nombre}: solo quedan ${stockMax} unidad${stockMax === 1 ? '' : 'es'}` };
    }
  }
  const items = [];
  for (const it of p.items) {
    const prod = c.productos.find(x => x.id === it.id);
    const stockMax = prod.stock != null ? prod.stock : 99;
    const qty = Math.min(stockMax, 99, Math.max(1, Math.round(Number(it.qty) || 1)));
    const custom = {};
    if (it.custom && typeof it.custom === 'object') {
      for (const [k, v] of Object.entries(it.custom).slice(0, 12)) {
        if (String(k).startsWith('_')) continue;
        custom[String(k).slice(0, 30)] = String(v).slice(0, 200);
      }
    }
    const item = { id: prod.id, nombre: prod.nombre, qty, precio: prod.precio, custom };
    if (it.fotoThumb && typeof it.fotoThumb === 'string') {
      item.fotoThumb = it.fotoThumb.slice(0, 80000);
      item.custom = { ...custom, foto: '✓ adjunta en pedido' };
    }
    items.push(item);
  }
  const sub = items.reduce((s, i) => s + i.precio * i.qty, 0);
  const codCupon = String(p.cupon || '').toUpperCase();
  const cupones = c.config.cupones || {};
  const pctCupon = Object.prototype.hasOwnProperty.call(cupones, codCupon) ? Number(cupones[codCupon]) || 0 : 0;
  const descuento = Math.round(sub * pctCupon / 100);
  const envioDef = c.config.envios.find(e => e.id === p.envio);
  if (!envioDef) return { error: 'Opción de envío no válida' };
  const costoEnvio = (envioDef.id === 'nacional' && sub - descuento >= c.config.envioGratisDesde) ? 0 : envioDef.precio;

  const pedidoId = 'MG-' + Date.now().toString(36).toUpperCase();
  if (store.usaSupabase && ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY) {
    for (let i = 0; i < items.length; i++) {
      if (!items[i].fotoThumb) continue;
      try {
        const url = await subirFotoPedido(
          { SB_URL: ENV.SUPABASE_URL, SB_ANON: ENV.SUPABASE_ANON_KEY },
          pedidoId, i, items[i].fotoThumb
        );
        if (url) {
          items[i].fotoUrl = url;
          delete items[i].fotoThumb;
        }
      } catch (e) {
        console.error('[FOTO]', pedidoId, i, e.message);
        items[i].fotoThumb = items[i].fotoThumb.slice(0, 15000);
      }
    }
  } else {
    for (const item of items) {
      if (item.fotoThumb) item.fotoThumb = item.fotoThumb.slice(0, 80000);
    }
  }

  const pedido = {
    id: pedidoId,
    fecha: new Date().toISOString(),
    estado,
    modoPago: p.modoPago || 'whatsapp',
    nombre: String(p.nombre).slice(0, 80),
    email: String(p.email || '').slice(0, 80),
    telefono: String(p.telefono).slice(0, 20),
    ciudad: String(p.ciudad || '').slice(0, 60),
    direccion: String(p.direccion || '').slice(0, 120),
    envio: envioDef.id,
    costoEnvio,
    envioNombre: envioDef.nombre,
    cupon: pctCupon ? codCupon : null,
    descuento,
    regalo: !!p.regalo,
    mensajeRegalo: String(p.mensajeRegalo || '').slice(0, 300),
    recibe: String(p.recibe || '').slice(0, 80),
    notas: String(p.notas || '').slice(0, 500),
    items,
    total: sub - descuento + costoEnvio,
  };
  return { pedido, envioDef };
}

module.exports = { construirPedido };
