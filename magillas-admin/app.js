// Panel Magillas — habla directo con Supabase (Auth + REST + Storage).
// La seguridad la da RLS: sin sesión de admin, la base rechaza cualquier escritura.
const { SUPABASE_URL, SUPABASE_ANON_KEY, TIENDA_URL } = window.MAGILLAS_CONFIG;
const $ = s => document.querySelector(s);
const cop = n => '$' + Number(n || 0).toLocaleString('es-CO');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Las fotos antiguas son rutas de la tienda (/img/shop/...); las nuevas son URLs de Supabase.
const urlFoto = u => !u ? '' : (u.startsWith('http') ? u : TIENDA_URL + u);

let sesion = JSON.parse(localStorage.getItem('mg_sesion') || 'null');
let PRODUCTOS = [];
let CONTENIDO = {};
let editando = null;

// ── llamadas a Supabase ──
async function sb(ruta, { method = 'GET', body, prefer, auth = true, raw } = {}) {
  const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  headers.Authorization = 'Bearer ' + (auth && sesion ? sesion.access_token : SUPABASE_ANON_KEY);
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(SUPABASE_URL + ruta, {
    method, headers,
    body: raw ? body : (body != null ? JSON.stringify(body) : undefined),
  });
  if (r.status === 401 && auth) { salir('Tu sesión expiró. Entra de nuevo.'); throw new Error('401'); }
  const txt = await r.text();
  if (!r.ok) throw new Error(txt.slice(0, 250) || ('error ' + r.status));
  return txt ? JSON.parse(txt) : null;
}

function toast(msg, err) {
  const t = document.createElement('div');
  t.className = 'toast';
  if (err) t.style.background = 'var(--rojo)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ── sesión ──
$('#form-login').onsubmit = async e => {
  e.preventDefault();
  const btn = $('#btn-entrar');
  btn.disabled = true; btn.textContent = 'Entrando…';
  $('#login-msg').innerHTML = '';
  try {
    const d = await sb('/auth/v1/token?grant_type=password', {
      method: 'POST', auth: false,
      body: { email: $('#email').value.trim(), password: $('#clave').value },
    });
    sesion = d;
    // Comprobamos que además de tener cuenta, esté autorizado como admin.
    const ok = await sb('/rest/v1/rpc/magillas_es_admin', { method: 'POST', body: {} });
    if (!ok) { sesion = null; throw new Error('Esta cuenta no tiene permisos de administrador.'); }
    localStorage.setItem('mg_sesion', JSON.stringify(sesion));
    await entrar();
  } catch (err) {
    const m = /invalid|credentials/i.test(err.message) ? 'Correo o contraseña incorrectos.' : err.message;
    $('#login-msg').innerHTML = `<div class="aviso aviso-err">${esc(m)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
};

$('#btn-recuperar').onclick = async () => {
  const email = $('#email').value.trim();
  if (!email) return $('#login-msg').innerHTML = '<div class="aviso aviso-err">Escribe tu correo arriba primero.</div>';
  try {
    await sb('/auth/v1/recover', { method: 'POST', auth: false, body: { email } });
    $('#login-msg').innerHTML = '<div class="aviso aviso-ok">Te enviamos un correo para restablecer la contraseña.</div>';
  } catch {
    $('#login-msg').innerHTML = '<div class="aviso aviso-err">No se pudo enviar. Intenta de nuevo.</div>';
  }
};

function salir(msg) {
  sesion = null;
  localStorage.removeItem('mg_sesion');
  $('#pantalla-panel').hidden = true;
  $('#pantalla-login').hidden = false;
  if (msg) $('#login-msg').innerHTML = `<div class="aviso aviso-err">${esc(msg)}</div>`;
}
$('#btn-salir').onclick = () => salir();

async function entrar() {
  $('#pantalla-login').hidden = true;
  $('#pantalla-panel').hidden = false;
  $('#quien').textContent = sesion?.user?.email || '';
  await cargarTodo();
}

// ── carga ──
async function cargarTodo() {
  try {
    const [prods, bloques] = await Promise.all([
      sb('/rest/v1/magillas_products?select=*&order=nombre.asc'),
      sb('/rest/v1/magillas_content?select=clave,valor'),
    ]);
    PRODUCTOS = prods;
    CONTENIDO = {};
    for (const b of bloques) CONTENIDO[b.clave] = b.valor;
    llenarCategorias();
    pintarProductos();
    pintarBloques();
  } catch (e) {
    $('#lista-productos').innerHTML = `<div class="aviso aviso-err">No se pudo cargar: ${esc(e.message)}</div>`;
  }
}

function categorias() { return CONTENIDO.categorias || []; }
function nombreCat(id) { return (categorias().find(c => c.id === id) || {}).nombre || id; }

function llenarCategorias() {
  $('#filtro-cat').innerHTML = '<option value="">Todas las categorías</option>' +
    categorias().map(c => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');
}

// ── pestañas ──
document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
  $('#vista-productos').hidden = t.dataset.vista !== 'productos';
  $('#vista-contenido').hidden = t.dataset.vista !== 'contenido';
});

// ── productos ──
$('#buscar').oninput = pintarProductos;
$('#filtro-cat').onchange = pintarProductos;
$('#solo-inactivos').onchange = pintarProductos;

function productosVisibles() {
  const q = $('#buscar').value.trim().toLowerCase();
  const cat = $('#filtro-cat').value;
  const soloOcultos = $('#solo-inactivos').checked;
  return PRODUCTOS.filter(p =>
    (!q || p.nombre.toLowerCase().includes(q)) &&
    (!cat || p.categoria === cat) &&
    (!soloOcultos || !p.activo));
}

function pintarProductos() {
  const lista = productosVisibles();
  $('#contador').textContent = `${lista.length} de ${PRODUCTOS.length}`;
  if (!lista.length) { $('#lista-productos').innerHTML = '<p class="vacio">Sin resultados.</p>'; return; }
  $('#lista-productos').innerHTML = lista.map(p => `
    <div class="item ${p.activo ? '' : 'inactivo'}">
      <img src="${esc(urlFoto(p.img))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div>
        <div class="item-nom">${esc(p.nombre)}
          ${p.activo ? '' : '<span class="pill pill-off">Oculto</span>'}
          ${p.destacado ? '<span class="pill">Destacado</span>' : ''}
          ${p.badge ? `<span class="pill">${esc(p.badge)}</span>` : ''}
        </div>
        <div class="item-meta">
          ${esc(nombreCat(p.categoria))} · ${cop(p.precio)}
          ${p.precio_antes ? ` (antes ${cop(p.precio_antes)})` : ''} · stock ${p.stock}
        </div>
      </div>
      <button class="btn btn-sm" data-editar="${esc(p.id)}">Editar</button>
    </div>`).join('');
  document.querySelectorAll('[data-editar]').forEach(b =>
    b.onclick = () => abrirEditor(PRODUCTOS.find(x => x.id === b.dataset.editar)));
}

$('#btn-nuevo').onclick = () => abrirEditor(null);

function abrirEditor(p) {
  const nuevo = !p;
  editando = nuevo
    ? { id: '', nombre: '', categoria: categorias()[0]?.id || 'otros', precio: 0, precio_antes: null,
        descripcion: '', img: '', imgs: [], stock: 0, destacado: false, badge: '', activo: true, _nuevo: true }
    : { ...p, imgs: Array.isArray(p.imgs) ? [...p.imgs] : [] };

  $('#editor-titulo').textContent = nuevo ? 'Nuevo producto' : 'Editar producto';
  $('#btn-borrar').hidden = nuevo;
  $('#editor-body').innerHTML = `
    <div class="campo"><label>Nombre</label><input id="e-nombre" value="${esc(editando.nombre)}" maxlength="120"></div>
    ${nuevo ? `<div class="campo"><label>Identificador (para el enlace, sin espacios)</label>
      <input id="e-id" placeholder="ej: collar-luna-dorada" maxlength="60"></div>` : ''}
    <div class="fila">
      <div class="campo"><label>Categoría</label><select id="e-cat">${
        categorias().map(c => `<option value="${esc(c.id)}" ${c.id === editando.categoria ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')
      }</select></div>
      <div class="campo"><label>Precio (COP)</label><input type="number" id="e-precio" value="${editando.precio}" min="0" step="500"></div>
      <div class="campo"><label>Precio antes (opcional)</label><input type="number" id="e-antes" value="${editando.precio_antes || ''}" min="0" step="500" placeholder="solo si está en oferta"></div>
      <div class="campo"><label>Stock</label><input type="number" id="e-stock" value="${editando.stock}" min="0"></div>
    </div>
    <div class="campo"><label>Descripción</label><textarea id="e-desc" maxlength="2000">${esc(editando.descripcion || '')}</textarea></div>
    <div class="fila">
      <div class="campo"><label>Etiqueta (badge)</label><input id="e-badge" value="${esc(editando.badge || '')}" maxlength="30" placeholder="ej: Más vendido"></div>
      <div class="campo" style="flex:0 0 auto">
        <label>Opciones</label>
        <div class="fila" style="gap:1rem">
          <label class="check"><input type="checkbox" id="e-activo" ${editando.activo ? 'checked' : ''}> Visible en la tienda</label>
          <label class="check"><input type="checkbox" id="e-destacado" ${editando.destacado ? 'checked' : ''}> Destacado</label>
        </div>
      </div>
    </div>
    <div class="campo">
      <label>Fotos (la primera es la principal)</label>
      <div class="fotos" id="e-fotos"></div>
      <div class="drop" id="e-drop">Arrastra fotos aquí o haz clic para elegir (JPG/PNG/WebP, máx 5 MB)</div>
      <input type="file" id="e-file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden>
    </div>
    ${editando.preview ? '<div class="aviso aviso-ok">Este producto tiene vista previa de personalización configurada. Se conserva al guardar.</div>' : ''}
    <div id="editor-msg"></div>`;

  pintarFotos();
  const file = $('#e-file'), drop = $('#e-drop');
  drop.onclick = () => file.click();
  file.onchange = () => subirFotos([...file.files]);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('hover'); };
  drop.ondragleave = () => drop.classList.remove('hover');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('hover'); subirFotos([...e.dataTransfer.files]); };

  $('#overlay-producto').hidden = false;
}

function fotosDe() {
  const todas = [...(editando.img ? [editando.img] : []), ...editando.imgs.filter(u => u !== editando.img)];
  return [...new Set(todas)];
}

function pintarFotos() {
  const fotos = fotosDe();
  $('#e-fotos').innerHTML = fotos.length ? fotos.map((u, i) => `
    <div class="foto ${i === 0 ? 'foto-princ' : ''}">
      <img src="${esc(urlFoto(u))}" alt="" loading="lazy">
      <button class="foto-x" data-quitar="${esc(u)}" title="Quitar">&times;</button>
      ${i === 0 ? '' : `<button class="foto-set" data-principal="${esc(u)}">Principal</button>`}
    </div>`).join('') : '<p class="contador">Sin fotos todavía.</p>';

  document.querySelectorAll('[data-quitar]').forEach(b => b.onclick = () => {
    const u = b.dataset.quitar;
    editando.imgs = editando.imgs.filter(x => x !== u);
    if (editando.img === u) editando.img = editando.imgs[0] || '';
    pintarFotos();
  });
  document.querySelectorAll('[data-principal]').forEach(b => b.onclick = () => {
    editando.img = b.dataset.principal;
    pintarFotos();
  });
}

async function subirFotos(archivos) {
  const validos = archivos.filter(f => f.size <= 5 * 1024 * 1024);
  if (validos.length < archivos.length) toast('Algunas fotos pasan de 5 MB y se omitieron', true);
  for (const f of validos) {
    const nombre = `productos/${Date.now()}-${f.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-')}`;
    $('#editor-msg').innerHTML = `<div class="aviso aviso-ok">Subiendo ${esc(f.name)}…</div>`;
    try {
      await fetch(`${SUPABASE_URL}/storage/v1/object/magillas-catalogo/${nombre}`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + sesion.access_token, 'Content-Type': f.type },
        body: f,
      }).then(async r => { if (!r.ok) throw new Error((await r.text()).slice(0, 160)); });
      const url = `${SUPABASE_URL}/storage/v1/object/public/magillas-catalogo/${nombre}`;
      editando.imgs.push(url);
      if (!editando.img) editando.img = url;
      pintarFotos();
      $('#editor-msg').innerHTML = '';
    } catch (e) {
      $('#editor-msg').innerHTML = `<div class="aviso aviso-err">No se pudo subir: ${esc(e.message)}</div>`;
    }
  }
}

$('#btn-guardar').onclick = async () => {
  const btn = $('#btn-guardar');
  const nombre = $('#e-nombre').value.trim();
  if (!nombre) return $('#editor-msg').innerHTML = '<div class="aviso aviso-err">Ponle un nombre al producto.</div>';
  const id = editando._nuevo
    ? ($('#e-id').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') ||
       nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    : editando.id;
  if (editando._nuevo && PRODUCTOS.some(p => p.id === id)) {
    return $('#editor-msg').innerHTML = '<div class="aviso aviso-err">Ya existe un producto con ese identificador.</div>';
  }

  const fotos = fotosDe();
  const fila = {
    id, nombre,
    categoria: $('#e-cat').value,
    precio: Math.max(0, parseInt($('#e-precio').value, 10) || 0),
    precio_antes: $('#e-antes').value ? parseInt($('#e-antes').value, 10) : null,
    descripcion: $('#e-desc').value.trim(),
    img: fotos[0] || null,
    imgs: fotos,
    stock: Math.max(0, parseInt($('#e-stock').value, 10) || 0),
    destacado: $('#e-destacado').checked,
    badge: $('#e-badge').value.trim() || null,
    activo: $('#e-activo').checked,
  };
  if (fila.precio_antes && fila.precio_antes <= fila.precio) {
    return $('#editor-msg').innerHTML = '<div class="aviso aviso-err">El "precio antes" debe ser mayor que el precio actual, si no parece que subiste el precio.</div>';
  }

  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await sb('/rest/v1/magillas_products' + (editando._nuevo ? '' : `?id=eq.${encodeURIComponent(id)}`), {
      method: editando._nuevo ? 'POST' : 'PATCH',
      body: fila, prefer: 'return=minimal',
    });
    $('#overlay-producto').hidden = true;
    toast('Guardado ✓');
    await cargarTodo();
  } catch (e) {
    $('#editor-msg').innerHTML = `<div class="aviso aviso-err">${esc(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
};

$('#btn-borrar').onclick = async () => {
  if (!confirm(`¿Eliminar "${editando.nombre}"? Si solo quieres quitarlo de la tienda, desmarca "Visible" y guarda.`)) return;
  try {
    await sb(`/rest/v1/magillas_products?id=eq.${encodeURIComponent(editando.id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    $('#overlay-producto').hidden = true;
    toast('Eliminado');
    await cargarTodo();
  } catch (e) { toast(e.message, true); }
};

// ── contenido del sitio ──
const ETIQUETAS = {
  categorias: ['Categorías', 'Nombres y orden de las categorías de la tienda'],
  whatsapp: ['WhatsApp', 'Número al que llegan los pedidos'],
  email: ['Correo', 'Correo de contacto de la tienda'],
  envios: ['Envíos', 'Opciones y costos de entrega'],
  envioGratisDesde: ['Envío gratis desde', 'Monto mínimo para envío nacional gratis'],
  cupones: ['Cupones', 'Códigos de descuento y su porcentaje'],
  beneficios: ['Beneficios', 'La franja de ventajas del inicio'],
  politicas: ['Políticas', 'Textos de garantía, cambios y cuidados'],
  ocasiones: ['Ocasiones', 'Regalos por ocasión'],
  redes: ['Redes sociales', 'Enlaces a Instagram y demás'],
  upsells: ['Complementos', 'Productos sugeridos al comprar'],
  empaquePremium: ['Empaque premium', 'Opción de empaque de regalo'],
  addi: ['Addi', 'Pago a cuotas'],
  addiDesde: ['Addi desde', 'Monto mínimo para pagar con Addi'],
  mayoristaWhatsapp: ['Mayoristas — WhatsApp', 'Número para pedidos al por mayor'],
  mayoristaMensaje: ['Mayoristas — mensaje', 'Mensaje que se autocompleta'],
  quizRegalo: ['Quiz de regalo', 'Preguntas del asistente de regalos'],
  analytics: ['Analítica', 'IDs de Google Analytics y Meta Pixel'],
  pagosOnline: ['Pagos en línea', 'Interruptor interno de pagos'],
};

function pintarBloques() {
  const claves = Object.keys(CONTENIDO).sort((a, b) =>
    (ETIQUETAS[a]?.[0] || a).localeCompare(ETIQUETAS[b]?.[0] || b));
  $('#lista-bloques').innerHTML = claves.map(k => {
    const [titulo, desc] = ETIQUETAS[k] || [k, 'Ajuste del sitio'];
    return `<div class="bloque" data-bloque="${esc(k)}">
      <h3>${esc(titulo)}</h3><p>${esc(desc)}</p></div>`;
  }).join('');
  document.querySelectorAll('[data-bloque]').forEach(b => b.onclick = () => abrirBloque(b.dataset.bloque));
}

let bloqueActual = null;
function abrirBloque(clave) {
  bloqueActual = clave;
  const [titulo, desc] = ETIQUETAS[clave] || [clave, ''];
  const valor = CONTENIDO[clave];
  const simple = typeof valor === 'string' || typeof valor === 'number';
  $('#bloque-titulo').textContent = titulo;
  $('#bloque-body').innerHTML = `
    <p class="contador">${esc(desc)}</p>
    ${simple
      ? `<div class="campo"><label>Valor</label><input id="b-valor" value="${esc(valor)}"></div>`
      : `<div class="campo"><label>Contenido</label>
         <textarea id="b-valor" class="json-edit" spellcheck="false">${esc(JSON.stringify(valor, null, 2))}</textarea>
         <p class="contador">Respeta las comillas y las comas. Si algo queda mal, te avisamos antes de guardar.</p></div>`}
    <div id="bloque-msg"></div>`;
  $('#overlay-bloque').hidden = false;
}

$('#btn-guardar-bloque').onclick = async () => {
  const btn = $('#btn-guardar-bloque');
  const bruto = $('#b-valor').value;
  const original = CONTENIDO[bloqueActual];
  let valor;
  if (typeof original === 'string') valor = bruto;
  else if (typeof original === 'number') {
    valor = Number(bruto);
    if (Number.isNaN(valor)) return $('#bloque-msg').innerHTML = '<div class="aviso aviso-err">Debe ser un número.</div>';
  } else {
    try { valor = JSON.parse(bruto); }
    catch (e) { return $('#bloque-msg').innerHTML = `<div class="aviso aviso-err">Hay un error de formato: ${esc(e.message)}</div>`; }
  }
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await sb(`/rest/v1/magillas_content?clave=eq.${encodeURIComponent(bloqueActual)}`, {
      method: 'PATCH', body: { valor }, prefer: 'return=minimal',
    });
    $('#overlay-bloque').hidden = true;
    toast('Guardado ✓');
    await cargarTodo();
  } catch (e) {
    $('#bloque-msg').innerHTML = `<div class="aviso aviso-err">${esc(e.message)}</div>`;
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
};

// ── cerrar diálogos ──
document.querySelectorAll('.overlay').forEach(ov => ov.addEventListener('click', e => {
  if (e.target === ov || e.target.closest('[data-cerrar]')) ov.hidden = true;
}));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(o => o.hidden = true);
});

// ── arranque ──
if (sesion) entrar().catch(() => salir());
