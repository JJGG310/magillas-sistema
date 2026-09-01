// Magillas Accesorios — servidor MVP (cero dependencias, Node 18+)
// Sirve el frontend, expone catálogo, guarda pedidos y hace de proxy al asistente IA (DeepSeek).
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── .env: Vercel usa variables de entorno; local lee .env ──
const ENV = {};
for (const k of ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL', 'ADMIN_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SITE_URL', 'WOMPI_PRIVATE_KEY', 'WOMPI_EVENTS_SECRET', 'RESEND_API_KEY', 'RESEND_FROM', 'GA4_ID', 'META_PIXEL_ID']) {
  if (process.env[k]) ENV[k] = process.env[k];
}
if (!ENV.DEEPSEEK_API_KEY) {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !ENV[m[1]]) ENV[m[1]] = m[2].trim();
    }
  } catch { /* sin .env el chat responde 503 */ }
}

const PORT = process.env.PORT || 3210;
const DATA_BUNDLE = path.join(__dirname, 'data');
// En Vercel el disco es de solo lectura salvo /tmp: pedidos/reseñas/newsletter van ahí.
const DATA = process.env.VERCEL ? path.join('/tmp', 'magillas-data') : DATA_BUNDLE;
const PUBLIC = path.join(__dirname, 'public');
const ORDERS = path.join(DATA, 'orders.json');
const REVIEWS = path.join(DATA, 'reviews.json');
const NEWS = path.join(DATA, 'newsletter.json');

function initDataVercel() {
  if (!process.env.VERCEL) return;
  fs.mkdirSync(DATA, { recursive: true });
  for (const f of ['orders.json', 'reviews.json', 'newsletter.json']) {
    const dest = path.join(DATA, f);
    if (fs.existsSync(dest)) continue;
    const src = path.join(DATA_BUNDLE, f);
    fs.writeFileSync(dest, fs.existsSync(src) ? fs.readFileSync(src, 'utf8') : '[]');
  }
}
initDataVercel();

const SITE_URL = (ENV.SITE_URL || 'https://magillasaccesorios.com').replace(/\/$/, '');

const ORIGENES_OK = [
  'https://magillas-web.vercel.app',
  'https://magillasaccesorios.com',
  'https://www.magillasaccesorios.com',
  'http://localhost:3210',
  'http://127.0.0.1:3210',
];
function origenOk(req) {
  if (!process.env.VERCEL) return true;
  const o = req.headers.origin || req.headers.referer || '';
  if (ORIGENES_OK.some(base => o.startsWith(base))) return true;
  if (/^https:\/\/magillas[\w-]*\.vercel\.app/.test(o)) return true;
  return false;
}

const HEADERS_SEG = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Lectura tolerante: si el archivo existe pero está corrupto NO devolvemos [] silencioso
// (escribir sobre eso borraría el historial). Se marca corrupto y se bloquea la escritura.
const corruptos = new Set();
function leerJson(f, def) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return def;       // aún no existe: normal
    corruptos.add(f);
    console.error(`[DATOS] ${path.basename(f)} ilegible/corrupto:`, e.message);
    return def;
  }
}

// Escritura segura: respaldo + escritura atómica (tmp + rename) para no perder datos si se cae a mitad.
function escribirJson(f, datos) {
  if (corruptos.has(f)) throw new Error(`${path.basename(f)} está corrupto; no se sobrescribe para no perder datos`);
  try { if (fs.existsSync(f)) fs.copyFileSync(f, f + '.bak'); } catch { /* el respaldo es best-effort */ }
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(datos, null, 2));
  fs.renameSync(tmp, f);
}

const { crearStore } = require('./lib/store');
const store = crearStore({ DATA, DATA_BUNDLE, ORDERS, REVIEWS, NEWS, leerJson, escribirJson, corruptos });
const { construirPedido } = require('./lib/pedido');
const { crearLinkPago, verificarFirmaWebhook } = require('./lib/wompi');
const { emailPedidoRecibido, emailPedidoEnviado, emailPedirResena } = require('./lib/email');

let SPECS = {};
let BLOG = { articulos: [] };
try { SPECS = JSON.parse(fs.readFileSync(path.join(DATA_BUNDLE, 'specs.json'), 'utf8')); } catch { /* opcional */ }
try { BLOG = JSON.parse(fs.readFileSync(path.join(DATA_BUNDLE, 'blog.json'), 'utf8')); } catch { /* opcional */ }

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

// Catálogo: primero Supabase (editable desde el panel), si no el products.json del proyecto.
const { crearCatalogoRemoto } = require('./lib/catalogo-remoto');
const catalogoRemoto = crearCatalogoRemoto({
  SUPABASE_URL: ENV.SUPABASE_URL,
  SUPABASE_ANON_KEY: ENV.SUPABASE_ANON_KEY,
});

let catalogoCache = null;   // último catálogo bueno (venga de donde venga)
let catalogoOrigen = 'archivo';

function catalogoArchivo() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_BUNDLE, 'products.json'), 'utf8'));
  } catch (e) {
    console.error('[CATÁLOGO] no se pudo leer products.json:', e.message);
    return null;
  }
}

// Se llama al inicio de cada petición. Con caché fresco no cuesta nada.
async function refrescarCatalogo() {
  if (catalogoRemoto.activo) {
    const remoto = await catalogoRemoto.obtener();
    if (remoto) { catalogoCache = remoto; catalogoOrigen = 'supabase'; return; }
  }
  const local = catalogoArchivo();
  if (local) { catalogoCache = local; catalogoOrigen = 'archivo'; }
}

function catalogo() {
  if (!catalogoCache) {
    const local = catalogoArchivo();
    if (!local) throw new Error('sin catálogo disponible');
    catalogoCache = local;
  }
  return catalogoCache;
}

// Catálogo público: sin cupones ni datos internos
function catalogoPublico() {
  const c = catalogo();
  const { cupones, ...configSinCupones } = c.config;
  const pagosWompi = !!ENV.WOMPI_PRIVATE_KEY;
  let beneficios = [...(configSinCupones.beneficios || [])];
  if (!pagosWompi) {
    beneficios = beneficios.map(b =>
      b.includes('PSE') ? '💳 Nequi · Transferencia · Contraentrega · Addi' : b
    );
  }
  return {
    ...c,
    config: {
      ...configSinCupones,
      beneficios,
      tieneCupones: !!(cupones && Object.keys(cupones).length),
      pagosWompi,
      analytics: {
        ga4: ENV.GA4_ID || configSinCupones.analytics?.ga4 || '',
        metaPixel: ENV.META_PIXEL_ID || configSinCupones.analytics?.metaPixel || '',
      },
    },
    especificaciones: SPECS,
    quizRegalo: c.config.quizRegalo || null,
  };
}

function normTel(t) {
  return String(t || '').replace(/\D/g, '');
}

// ── Rate limit: Supabase distribuido + fallback memoria ──
const { crearRateLimit } = require('./lib/ratelimit');
const crypto = require('crypto');
function tokenIgual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function json(res, code, obj, extraHeaders = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...HEADERS_SEG, ...extraHeaders });
  res.end(JSON.stringify(obj));
}

const { limitar } = crearRateLimit({
  SB_URL: ENV.SUPABASE_URL,
  SB_ANON: ENV.SUPABASE_ANON_KEY,
  json,
});

function body(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) { reject(new Error('payload muy grande')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { reject(new Error('JSON inválido')); } });
  });
}

// ── Asistente IA: contexto de la tienda generado desde el catálogo ──
function systemPrompt() {
  const c = catalogo();
  const top = c.productos.filter(p => p.destacado).slice(0, 8);
  const lista = c.productos.map(p => `- id:${p.id} | ${p.nombre} ($${p.precio.toLocaleString('es-CO')} COP): ${p.desc}${p.custom ? ' [personalizable]' : ''}`).join('\n');
  const destacados = top.map(p => `${p.nombre} (id:${p.id})`).join(', ');
  const envios = c.config.envios.map(e => `- ${e.nombre}: ${e.precio === 0 ? 'gratis' : '$' + e.precio.toLocaleString('es-CO') + ' COP'}`).join('\n');
  const pagoLinea = ENV.WOMPI_PRIVATE_KEY
    ? '- Pagos en el sitio: botón "Pagar en línea" (PSE, tarjeta, Nequi) en el carrito, o "Confirmar por WhatsApp".'
    : '- Pagos: al confirmar en el carrito por WhatsApp coordinamos Nequi, transferencia, contraentrega o Addi (cuotas desde $100.000).';
  return `Eres "Magui", la asistente virtual de MAGILLAS ® (@magillas_accesorios), tienda caleña de accesorios y regalos personalizados con envíos a toda Colombia. Tono: cercano, cálido, colombiano, breve (2-4 frases por respuesta), con emojis con moderación. Escribe SIEMPRE en texto plano: nada de markdown, asteriscos, ni listas con guiones.

CATÁLOGO ACTUAL (usa el nombre exacto del producto cuando recomiendes):
${lista}

MÁS VENDIDOS: ${destacados}

ENVÍOS:
${envios}
Envío nacional GRATIS en compras desde $${c.config.envioGratisDesde.toLocaleString('es-CO')} COP.

CÓMO COMPRAR EN EL SITIO (prioriza este flujo antes de mandar solo a WhatsApp):
1) El cliente abre el producto en la tienda (tú puedes nombrarlo con su nombre exacto del catálogo).
2) Si es personalizable, escribe mensaje o nombre y ve la vista previa en tiempo real en la foto.
3) Añade al carrito (icono arriba a la derecha), completa nombre, celular y ciudad.
4) Confirma por WhatsApp o paga en línea si está disponible.
5) Para fotos a grabar, las envía por WhatsApp al confirmar; antes de producir mostramos vista previa final.

PERSONALIZACIÓN: vista previa en vivo en la web. Foto a grabar por WhatsApp al confirmar. Tienes 2 HORAS tras confirmar para corregir el TEXTO del grabado sin costo; después entramos a producción. Piezas personalizadas: 3-5 días hábiles. Estándar: 1-2 días. Estuche de regalo incluido.

POLÍTICAS:
- Materiales: acero inoxidable, chapados en oro, neopreno y mostacilla.
- Garantía: 5 días hábiles para faltantes. Personalizados sin retracto. Anillos sin cambio por talla.
- Tallas: pulseras ajustables 14-22 cm. Collares 45 cm + extensor.
- Rastreo: pie de página "Rastrear pedido" con código MG-... y celular.
- Cupones: invita a unirse al boletín en el pie de página (no des el código).
- Mayoristas: enlace "¿Quieres ser mayorista?" o /mayorista.html
${pagoLinea}

REGLAS DE VENTA:
- Siempre que recomiendes un producto, escribe su NOMBRE EXACTO como aparece en el catálogo (así el cliente ve el botón para abrirlo).
- Guía al carrito y checkout del sitio; WhatsApp es para confirmar personalización o si prefieren pagar así.
- Nunca inventes precios ni productos que no estén en el catálogo.
- Si no sabes algo, dilo e invita a WhatsApp +57 316 5864539 o Instagram @magillas_accesorios.`;
}

async function chat(req, res) {
  if (!ENV.DEEPSEEK_API_KEY) return json(res, 503, { error: 'Asistente no configurado' });
  if (process.env.VERCEL && !origenOk(req)) return json(res, 403, { error: 'origen no permitido' });
  const { messages } = await body(req);
  if (!Array.isArray(messages) || !messages.length) return json(res, 400, { error: 'messages requerido' });
  const recortados = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000)
  }));
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 45000);          // DeepSeek colgado no deja la conexión abierta
  req.on('close', () => ctrl.abort());                          // si el cliente cierra, dejamos de gastar tokens
  try {
    const r = await fetch((ENV.DEEPSEEK_BASE_URL || 'https://api.deepseek.com') + '/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ENV.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: ENV.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'system', content: systemPrompt() }, ...recortados],
        max_tokens: 1200, // deepseek-v4-flash razona antes de responder; el razonamiento consume tokens
        temperature: 0.7,
        stream: true
      })
    });
    if (!r.ok) {
      console.error('DeepSeek error', r.status, (await r.text()).slice(0, 300));
      return json(res, 502, { error: 'El asistente no está disponible ahora mismo' });
    }
    // reenvía los tokens al navegador a medida que llegan (texto plano chunked)
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' });
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of r.body) {
      if (res.writableEnded) break;
      buffer += decoder.decode(chunk, { stream: true });
      const lineas = buffer.split('\n');
      buffer = lineas.pop(); // línea incompleta queda para el próximo chunk
      for (const l of lineas) {
        if (!l.startsWith('data: ')) continue;
        const dato = l.slice(6).trim();
        if (dato === '[DONE]') continue;
        try {
          const token = JSON.parse(dato).choices?.[0]?.delta?.content;
          if (token) res.write(token);
        } catch { /* chunk no-JSON, se ignora */ }
      }
    }
    res.end();
  } catch (e) {
    // clave: si ya mandamos headers no se puede responder JSON (eso reventaba el proceso entero)
    console.error('[CHAT]', e.message);
    if (res.headersSent) { try { res.end(); } catch { } }
    else json(res, 502, { error: 'El asistente no está disponible ahora mismo' });
  } finally {
    clearTimeout(corte);
  }
}

function rawBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 2e6) { reject(new Error('payload muy grande')); req.destroy(); } });
    req.on('end', () => resolve(b));
  });
}

async function guardarPedido(req, res) {
  const p = await body(req);
  const built = await construirPedido(p, { catalogo, store, ENV, estado: 'recibido' });
  if (built.error) return json(res, 400, { error: built.error });
  const { pedido, envioDef } = built;
  await store.guardarPedido(pedido);
  emailPedidoRecibido({ ...ENV, SITE_URL }, pedido).catch(e => console.error('[EMAIL]', e.message));
  json(res, 201, {
    ok: true,
    id: pedido.id,
    total: pedido.total,
    descuento: pedido.descuento,
    costoEnvio: pedido.costoEnvio,
    envio: pedido.envio,
    envioNombre: envioDef.nombre,
    cupon: pedido.cupon,
    items: pedido.items,
  });
}

async function pagarConWompi(req, res) {
  if (!ENV.WOMPI_PRIVATE_KEY) return json(res, 503, { error: 'Pagos en línea no disponibles aún. Usa WhatsApp.' });
  const p = await body(req);
  const built = await construirPedido({ ...p, modoPago: 'wompi' }, { catalogo, store, ENV, estado: 'pendiente_pago' });
  if (built.error) return json(res, 400, { error: built.error });
  const { pedido, envioDef } = built;
  await store.guardarPedido(pedido);
  try {
    const redirect = `${SITE_URL}/?pago=ok&id=${encodeURIComponent(pedido.id)}`;
    const { url } = await crearLinkPago({
      privateKey: ENV.WOMPI_PRIVATE_KEY,
      pedidoId: pedido.id,
      total: pedido.total,
      nombre: pedido.nombre,
      redirectUrl: redirect,
    });
    json(res, 201, {
      ok: true,
      id: pedido.id,
      total: pedido.total,
      paymentUrl: url,
      envioNombre: envioDef.nombre,
      items: pedido.items,
    });
  } catch (e) {
    console.error('[WOMPI]', e.message);
    await store.actualizarPedido(pedido.id, { estado: 'cancelado', notasPago: e.message });
    json(res, 502, { error: 'No se pudo abrir la pasarela de pago. Intenta por WhatsApp.' });
  }
}

async function webhookWompi(req, res) {
  const raw = await rawBody(req);
  const sig = req.headers['x-event-checksum'] || req.headers['x-wompi-signature'] || '';
  if (ENV.WOMPI_EVENTS_SECRET && sig && !verificarFirmaWebhook(raw, sig, ENV.WOMPI_EVENTS_SECRET)) {
    return json(res, 401, { error: 'firma inválida' });
  }
  let ev;
  try { ev = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: 'json inválido' }); }
  const tx = ev?.data?.transaction || {};
  const pedidoId = tx.sku || tx.reference;
  if (pedidoId && tx.status === 'APPROVED') {
    await store.actualizarPedido(String(pedidoId), { estado: 'recibido', pagadoEn: new Date().toISOString() });
  }
  json(res, 200, { ok: true });
}

async function rastrear(res, url) {
  const id = (url.searchParams.get('id') || '').trim().toUpperCase();
  const tel = normTel(url.searchParams.get('tel'));
  const pedido = await store.pedidoPorId(id);
  const pedTel = normTel(pedido?.telefono);
  if (!pedido || tel.length < 10 || pedTel !== tel) {
    return json(res, 404, { error: 'No encontramos ese pedido. Revisa el código y el celular completo.' });
  }
  json(res, 200, { id: pedido.id, fecha: pedido.fecha, estado: pedido.estado || 'recibido', guia: pedido.guia || null, transportadora: pedido.transportadora || null });
}

async function validarCupon(req, res) {
  const { codigo } = await body(req);
  const cupones = catalogo().config.cupones || {};
  const cod = String(codigo || '').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(cupones, cod)) {
    return json(res, 400, { error: 'Cupón no válido' });
  }
  json(res, 200, { ok: true, codigo: cod, descuento: Number(cupones[cod]) || 0 });
}

async function guardarResena(req, res) {
  const r = await body(req);
  const estrellas = Math.round(Number(r.estrellas));
  if (!r.producto || !r.nombre || !(estrellas >= 1 && estrellas <= 5)) {
    return json(res, 400, { error: 'producto, nombre y estrellas (1-5) son obligatorios' });
  }
  const prodId = String(r.producto).slice(0, 60);
  if (!catalogo().productos.find(p => p.id === prodId)) {
    return json(res, 400, { error: 'producto no existe en el catálogo' });
  }
  const review = {
    producto: prodId,
    nombre: String(r.nombre).slice(0, 60),
    estrellas,
    comentario: String(r.comentario || '').slice(0, 500),
    fecha: new Date().toISOString(),
  };
  await store.guardarResena(review);
  json(res, 201, { ok: true, pendiente: true, mensaje: '¡Gracias! Tu reseña se publicará tras una revisión rápida.' });
}

async function suscribir(req, res) {
  const { email } = await body(req);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return json(res, 400, { error: 'Email inválido' });
  const fecha = new Date().toISOString();
  await store.guardarNewsletter(email, fecha);
  const cupones = catalogo().config.cupones || {};
  const cupon = Object.keys(cupones)[0] || null;
  json(res, 200, { ok: true, cupon, descuento: cupon ? cupones[cupon] : 0 });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    await refrescarCatalogo();
    if (url.pathname === '/health') {
      return json(res, 200, { ok: true, uptime: Math.round(process.uptime()), store: store.usaSupabase ? 'supabase' : 'local', catalogo: catalogoOrigen });
    }
    if (url.pathname === '/api/products') {
      return json(res, 200, catalogoPublico(), { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' });
    }
    if (url.pathname === '/api/blog' && req.method === 'GET') {
      return json(res, 200, BLOG, { 'Cache-Control': 'public, max-age=3600' });
    }
    if (url.pathname === '/api/payments/wompi' && req.method === 'POST') {
      if (!origenOk(req)) return json(res, 403, { error: 'origen no permitido' });
      if (await limitar(req, res, 'pay', 8, 10 * 60_000)) return;
      return await pagarConWompi(req, res);
    }
    if (url.pathname === '/api/webhooks/wompi' && req.method === 'POST') {
      return await webhookWompi(req, res);
    }
    if (url.pathname === '/api/cupon' && req.method === 'POST') {
      if (!origenOk(req)) return json(res, 403, { error: 'origen no permitido' });
      if (await limitar(req, res, 'cupon', 10, 10 * 60_000)) return;
      return await validarCupon(req, res);
    }
    // el chat cuesta dinero real (key de DeepSeek): 12 mensajes por IP cada 5 min
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      if (await limitar(req, res, 'chat', 12, 5 * 60_000)) return;
      return await chat(req, res);
    }
    if (url.pathname === '/api/orders' && req.method === 'POST') {
      if (!origenOk(req)) return json(res, 403, { error: 'origen no permitido' });
      if (await limitar(req, res, 'orders', 10, 10 * 60_000)) return;
      return await guardarPedido(req, res);
    }
    if (url.pathname === '/api/track') {
      if (await limitar(req, res, 'track', 20, 5 * 60_000)) return;
      return await rastrear(res, url);
    }

    // ── admin (token en .env) ──
    if (url.pathname.startsWith('/api/admin/')) {
      if (await limitar(req, res, 'admin', 30, 5 * 60_000)) return;
      const tok = (req.headers.authorization || '').replace('Bearer ', '');
      if (!ENV.ADMIN_TOKEN || !tokenIgual(tok, ENV.ADMIN_TOKEN)) return json(res, 401, { error: 'No autorizado' });
      if (url.pathname === '/api/admin/orders' && req.method === 'GET') return json(res, 200, (await store.pedidosTodos()).slice());
      if (url.pathname === '/api/admin/orders' && req.method === 'PATCH') {
        const { id, estado, guia, transportadora } = await body(req);
        const ESTADOS = ['pendiente_pago', 'recibido', 'confirmado', 'elaborando', 'enviado', 'entregado', 'cancelado'];
        if (estado && !ESTADOS.includes(estado)) return json(res, 400, { error: 'estado inválido' });
        const parches = {};
        if (estado) parches.estado = estado;
        if (guia !== undefined) parches.guia = guia;
        if (transportadora !== undefined) parches.transportadora = transportadora;
        const ok = await store.actualizarPedido(id, parches);
        if (!ok) return json(res, 404, { error: 'pedido no existe' });
        const ped = await store.pedidoPorId(id);
        if (ped?.email) {
          if (estado === 'enviado') emailPedidoEnviado({ ...ENV, SITE_URL }, ped).catch(e => console.error('[EMAIL]', e.message));
          if (estado === 'entregado') emailPedirResena({ ...ENV, SITE_URL }, ped).catch(e => console.error('[EMAIL]', e.message));
        }
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/admin/data' && req.method === 'GET') {
        return json(res, 200, { newsletter: await store.newsletterTodos(), reviews: await store.resenasTodas() });
      }
      if (url.pathname === '/api/admin/reviews' && req.method === 'DELETE') {
        const { fecha, producto } = await body(req);
        await store.borrarResena(fecha, producto);
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/admin/reviews' && req.method === 'PATCH') {
        const { fecha, producto, aprobada } = await body(req);
        if (!fecha || !producto) return json(res, 400, { error: 'fecha y producto requeridos' });
        await store.aprobarResena(fecha, producto, !!aprobada);
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: 'ruta admin desconocida' });
    }
    if (url.pathname === '/api/reviews' && req.method === 'GET') return json(res, 200, await store.resenasPublicas());
    if (url.pathname === '/api/reviews' && req.method === 'POST' && await limitar(req, res, 'rv', 3, 30 * 60_000)) return;
    if (url.pathname === '/api/newsletter' && req.method === 'POST' && await limitar(req, res, 'news', 5, 30 * 60_000)) return;
    if (url.pathname === '/api/reviews' && req.method === 'POST') {
      if (!origenOk(req)) return json(res, 403, { error: 'origen no permitido' });
      return await guardarResena(req, res);
    }
    if (url.pathname === '/api/newsletter' && req.method === 'POST') {
      if (!origenOk(req)) return json(res, 403, { error: 'origen no permitido' });
      return await suscribir(req, res);
    }

    // páginas de producto compartibles: /p/<id> — misma SPA con OG tags del producto (previews en WhatsApp/IG)
    const mProd = url.pathname.match(/^\/p\/([a-z0-9-]+)$/);
    if (mProd) {
      const c = catalogo();
      const p = c.productos.find(x => x.id === mProd[1]);
      if (!p) { res.writeHead(302, { Location: '/' }); return res.end(); }
      let html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
      const abs = u => SITE_URL + u;
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${p.nombre} — MAGILLAS ®</title>`)
        .replace(/(<meta name="description" content=")[^"]*(">)/, `$1${p.desc.replace(/"/g, '&quot;')}$2`)
        .replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${p.nombre} — ${p.precio.toLocaleString('es-CO')} COP$2`)
        .replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${p.desc.replace(/"/g, '&quot;')}$2`)
        .replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${abs(p.img)}$2`)
        .replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${SITE_URL}/p/${p.id}$2`)
        .replace('</body>', `<script>window.OPEN_PRODUCT=${JSON.stringify(p.id)}</script></body>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...HEADERS_SEG });
      return res.end(html);
    }

    if (url.pathname === '/sitemap.xml') {
      const c = catalogo();
      const urls = [SITE_URL + '/', ...c.productos.map(p => `${SITE_URL}/p/${p.id}`)];
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>`);
    }
    if (url.pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`);
    }

    const mBlog = url.pathname.match(/^\/blog\/?([a-z0-9-]*)$/);
    if (mBlog) {
      const slug = mBlog[1];
      if (!slug) {
        let html = fs.readFileSync(path.join(PUBLIC, 'blog.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...HEADERS_SEG });
        return res.end(html);
      }
      const art = (BLOG.articulos || []).find(a => a.slug === slug);
      if (!art) { res.writeHead(302, { Location: '/blog' }); return res.end(); }
      let html = fs.readFileSync(path.join(PUBLIC, 'blog.html'), 'utf8');
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${art.titulo} — MAGILLAS ®</title>`)
        .replace('</body>', `<script>window.BLOG_ARTICLE=${JSON.stringify(art)}</script></body>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...HEADERS_SEG });
      return res.end(html);
    }

    // estáticos — admin.html solo con token en query (producción)
    if (url.pathname === '/admin.html' && process.env.VERCEL) {
      const qtok = url.searchParams.get('token') || '';
      if (!ENV.ADMIN_TOKEN || !tokenIgual(qtok, ENV.ADMIN_TOKEN)) {
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8', ...HEADERS_SEG });
        return res.end('<h1>403</h1><p>Panel admin: abre con <code>/admin.html?token=TU_TOKEN</code></p>');
      }
    }
    let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(PUBLIC)) return json(res, 403, { error: 'no' });
    fs.readFile(file, (err, buf) => {
      if (err) return json(res, 404, { error: 'no encontrado' });
      const ext = path.extname(file);
      const cacheable = ['.jpg', '.png', '.webp', '.svg', '.ico'].includes(ext);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': cacheable ? 'public, max-age=604800' : 'no-cache',
        ...HEADERS_SEG,
      });
      res.end(buf);
    });
  } catch (e) {
    console.error('[ERROR]', req.method, url.pathname, e.message);
    if (res.headersSent) return res.end();
    const esInputMalo = /JSON inválido|payload muy grande/.test(e.message);
    json(res, esInputMalo ? 400 : 500, { error: esInputMalo ? e.message : 'Error interno' });
  }
});

if (!process.env.VERCEL) {
  server.listen(PORT, () => console.log(`Magillas MVP en http://localhost:${PORT} — chat IA: ${ENV.DEEPSEEK_API_KEY ? 'activo' : 'SIN KEY'}`));
}

module.exports = server;

// Red de seguridad: un error suelto no debe tumbar la tienda entera (y queda registrado).
process.on('uncaughtException', e => console.error('[FATAL no atrapado]', e));
process.on('unhandledRejection', e => console.error('[PROMESA no atrapada]', e));
if (!process.env.VERCEL) {
  // Cierre ordenado: termina las conexiones en curso antes de salir.
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      console.log(`\n${sig} recibido, cerrando…`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }
}
