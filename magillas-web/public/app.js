// Magillas Accesorios — frontend MVP
let CATALOGO = null;
let RESENAS = [];
let cart = JSON.parse(localStorage.getItem('magillas_cart') || '[]');
let cupon = JSON.parse(localStorage.getItem('magillas_cupon') || 'null'); // {codigo, pct}

const $ = s => document.querySelector(s);
const cop = n => '$' + n.toLocaleString('es-CO');

const CUSTOM_LABELS = {
  nombre: 'Grabado', mensaje: 'Mensaje', nombre2: '2.º dije', iniciales: 'Iniciales',
  color: 'Color', talla: 'Talla', tipografia: 'Tipografía', foto: 'Foto',
};
const labelCustom = k => CUSTOM_LABELS[k] || k.replace(/_/g, ' ');

let modalAbort = null;
const FOTO_SS = 'magillas_fotos';
function fotoKey(pid, campo = 'foto') { return `${pid}:${campo}`; }
function guardarFotoRef(pid, campo, dataUrl) {
  const m = JSON.parse(sessionStorage.getItem(FOTO_SS) || '{}');
  m[fotoKey(pid, campo)] = dataUrl;
  sessionStorage.setItem(FOTO_SS, JSON.stringify(m));
}
function leerFotoRef(pid, campo = 'foto') {
  const m = JSON.parse(sessionStorage.getItem(FOTO_SS) || '{}');
  return m[fotoKey(pid, campo)] || '';
}

function qaFoto(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const issues = [];
      if (img.width < 400 || img.height < 400) issues.push('Imagen pequeña: usa al menos 400×400 px para mejor grabado.');
      if (img.width / img.height > 2.5 || img.height / img.width > 2.5) issues.push('Mejor una foto más cuadrada, con el rostro centrado.');
      resolve(issues);
    };
    img.onerror = () => resolve([]);
    img.src = dataUrl;
  });
}

function trackEvent(name, params = {}) {
  try {
    if (typeof gtag === 'function') gtag('event', name, params);
    if (typeof fbq === 'function') fbq('trackCustom', name, params);
  } catch { /* analytics opcional */ }
}

function initAnalytics(cfg) {
  const ga = cfg.analytics?.ga4;
  const px = cfg.analytics?.metaPixel;
  if (ga && !document.getElementById('ga4')) {
    const g = document.createElement('script');
    g.id = 'ga4'; g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + ga;
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', ga);
  }
  if (px && !document.getElementById('meta-pixel')) {
    const f = document.createElement('script');
    f.id = 'meta-pixel';
    f.textContent = "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','" + px + "');fbq('track','PageView');";
    document.head.appendChild(f);
  }
}

function comprimirFoto(file, maxW = 480) {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) return reject(new Error('max'));
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('img'));
      img.src = r.result;
    };
    r.onerror = () => reject(new Error('read'));
    r.readAsDataURL(file);
  });
}

function wireCardHovers(root) {
  if (!matchMedia('(hover: hover)').matches) return;
  root.querySelectorAll('.card-imgwrap').forEach(w => {
    const img = w.querySelector('.card-img');
    if (!img) return;
    const orig = img.src;
    const hover = img.dataset.hover;
    if (!hover || hover === orig) return;
    w.style.cursor = 'pointer';
    w.addEventListener('mouseenter', () => { img.src = hover; });
    w.addEventListener('mouseleave', () => { img.src = orig; });
  });
}

function esPersonalizable(p) {
  return !!(p.custom?.length && p.custom.some(c => c.type === 'text' || c.type === 'file'));
}

// ── init ──
esqueletos(); // placeholders mientras llega el catálogo
Promise.all([
  fetch('/api/products').then(r => { if (!r.ok) throw new Error('catálogo'); return r.json(); }),
  fetch('/api/reviews').then(r => r.json()).catch(() => [])
]).then(([c, rv]) => {
  CATALOGO = c;
  RESENAS = rv;
  renderNav(); renderBeneficios(); renderCats(); renderOcasiones(); renderWhy(); renderChips(); renderFeatured();
  renderReviewsCarousel(); renderBlog(); renderGrid('todos'); renderShipping(); renderCartBadge();
  handlePagoQuery(); initWaPopup(); initAnalytics(cfg); renderQuiz();
  const cfg = c.config;
  $('#link-wa-footer').href = 'https://wa.me/' + cfg.whatsapp;
  const waFab = document.getElementById('wa-fab');
  if (waFab) waFab.href = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent('Hola Magillas 👋 Me interesa un accesorio personalizado')}`;
  if (cfg.redes) {
    $('#link-ig').href = cfg.redes.instagram;
    $('#link-fb').href = cfg.redes.facebook;
    $('#link-tiktok').href = cfg.redes.tiktok;
  }
  if (cfg.email) $('#footer-contact').innerHTML = `📧 <a href="mailto:${cfg.email}">${cfg.email}</a> · 📱 <a href="https://wa.me/${cfg.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`;
  const msgMay = encodeURIComponent(cfg.mayoristaMensaje || 'Hola, me interesa comprar al por mayor');
  $('#link-mayorista').href = `https://wa.me/${cfg.mayoristaWhatsapp || cfg.whatsapp}?text=${msgMay}`;
  enlazarPoliticas(cfg.politicas || {});
  inyectarSchema();
  if (window.OPEN_PRODUCT) openProduct(window.OPEN_PRODUCT); // llegó por link compartido /p/<id>

  // reveal suave de secciones al hacer scroll (se desactiva con prefers-reduced-motion)
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const secciones = Array.from(document.querySelectorAll('.benefits, .cats, .occasions, .products, .reviews-home, .why-us, .steps, .quiz-home, .blog-home, .shipping, .faq, .made-strip'));
    secciones.forEach(s => s.classList.add('reveal'));
    const revisar = () => secciones.forEach(s => {
      if (!s.classList.contains('vis') && s.getBoundingClientRect().top < innerHeight - 40) s.classList.add('vis');
    });
    addEventListener('scroll', revisar, { passive: true });
    revisar();
  }
}).catch(() => {
  // sin catálogo la tienda no sirve: se lo decimos al cliente en vez de dejar huecos vacíos
  document.getElementById('cats-grid').innerHTML = '';
  document.getElementById('grid').innerHTML = `
    <div class="estado-error">
      <p>No pudimos cargar el catálogo 😔</p>
      <button class="btn btn-gold btn-sm" onclick="location.reload()">Reintentar</button>
      <p class="m-lead">O escríbenos por Instagram <a href="https://www.instagram.com/magillas_accesorios/" target="_blank" rel="noopener">@magillas_accesorios</a></p>
    </div>`;
});

// esqueletos de carga (evitan el "salto" de contenido y el vacío inicial)
function esqueletos() {
  document.getElementById('cats-grid').innerHTML = '<div class="sk sk-cat"></div>'.repeat(4);
  document.getElementById('grid').innerHTML = '<div class="sk sk-card"></div>'.repeat(6);
}

// JSON-LD: top productos + FAQ (no inyectar los 224 de golpe)
function inyectarSchema() {
  const top = CATALOGO.productos.slice(0, 20);
  const productos = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    numberOfItems: CATALOGO.productos.length,
    itemListElement: top.map((p, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: {
        '@type': 'Product', name: p.nombre, description: p.desc,
        image: location.origin + p.img,
        brand: { '@type': 'Brand', name: 'MAGILLAS ®' },
        offers: { '@type': 'Offer', price: p.precio, priceCurrency: 'COP', availability: 'https://schema.org/' + (p.stock === 0 ? 'OutOfStock' : 'InStock') }
      }
    }))
  };
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: Array.from(document.querySelectorAll('.faq-list details')).map(d => ({
      '@type': 'Question', name: d.querySelector('summary').textContent,
      acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent }
    }))
  };
  for (const obj of [productos, faq]) {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }
}

const resenasDe = id => RESENAS.filter(r => r.producto === id);
const estrellasHtml = (prom, n) =>
  `<span class="stars" title="${prom.toFixed(1)} de 5">${'★'.repeat(Math.round(prom))}${'☆'.repeat(5 - Math.round(prom))}</span> <span class="stars-n">(${n})</span>`;
function ratingDe(id) {
  const rs = resenasDe(id);
  if (!rs.length) return '';
  const prom = rs.reduce((s, r) => s + r.estrellas, 0) / rs.length;
  return estrellasHtml(prom, rs.length);
}

// barra de anuncio rotativa (patrón Primura/Dorado)
const ANUNCIOS = [
  'Envío nacional <strong>GRATIS</strong> desde $150.000 &nbsp;🇨🇴',
  '🔥 <strong>Ofertas</strong> y más vendidos — mira el catálogo completo',
  '✨ Personaliza con tu foto — <strong>vista previa en tiempo real</strong>',
  'Hecho a mano en Cali, con amor 🤍'
];
let anuncioI = 0;
setInterval(() => {
  const el = document.getElementById('announce-bar');
  if (!el) return;
  el.style.opacity = 0;
  setTimeout(() => { anuncioI = (anuncioI + 1) % ANUNCIOS.length; el.innerHTML = ANUNCIOS[anuncioI]; el.style.opacity = 1; }, 400);
}, 5000);

function renderNav() {
  // Solo las 4 categorías con más volumen caben en la barra; el resto va en "Más".
  // Con las 15 anteriores el nav desbordaba y empujaba el carrito fuera de la pantalla.
  const enBarra = ['ofertas', 'personalizables', 'collares', 'pulseras-neopreno'];
  const enMas = ['brazaletes', 'estuches', 'tobilleras', 'camandulas', 'candongas', 'anillos', 'pulseras-tejidas', 'seleccion-colombia', 'te-amo-100-idiomas'];
  const link = c => `<a href="#productos" data-cat="${c.id}">${c.nombre}</a>`;
  const cats = ids => ids.map(id => CATALOGO.categorias.find(c => c.id === id)).filter(Boolean).map(link).join('');
  const nav = $('#nav-cats');
  nav.innerHTML = cats(enBarra) +
    '<a href="#productos" data-cat="todos" class="nav-muted">Ver todo</a>' +
    `<div class="nav-mas">
       <button type="button" class="nav-mas-btn" aria-expanded="false">Más <span aria-hidden="true">▾</span></button>
       <div class="nav-mas-menu">
         ${cats(enMas)}
         <a href="#ocasiones">Ocasiones</a>
         <a href="/militar.html">Militar</a>
         <a href="/padre.html">Día del Padre</a>
         <a href="/blog">Guías</a>
       </div>
     </div>` +
    '<a href="#personaliza" class="nav-gold">✨ Personaliza</a>';

  const grupoMas = nav.querySelector('.nav-mas');
  const btnMas = nav.querySelector('.nav-mas-btn');
  const alternarMas = abrir => {
    grupoMas.classList.toggle('open', abrir);
    btnMas.setAttribute('aria-expanded', abrir);
  };
  btnMas.onclick = e => { e.stopPropagation(); alternarMas(!grupoMas.classList.contains('open')); };
  document.addEventListener('click', e => { if (!grupoMas.contains(e.target)) alternarMas(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') alternarMas(false); });

  nav.onclick = e => {
    const cat = e.target.dataset?.cat;
    if (cat) { filtroOcasion = null; document.getElementById('occasion-note')?.remove(); renderGrid(cat); $('#productos').scrollIntoView({ behavior: 'smooth' }); }
    if (e.target.closest('a')) {
      alternarMas(false);
      if (!e.target.classList.contains('nav-gold')) nav.classList.remove('open');
    }
  };
}

function renderCats() {
  $('#cats-grid').innerHTML = CATALOGO.categorias.map(c => `
    <button class="cat-card" data-cat="${c.id}">
      <img src="${c.img || '/img/shop/collar-carta.jpg'}" alt="${c.nombre}" loading="lazy">
      <span class="cat-info"><h3>${c.nombre}</h3><p>${c.desc}</p></span>
    </button>`).join('');
  $('#cats-grid').addEventListener('click', e => {
    const btn = e.target.closest('.cat-card');
    if (btn) { filtroOcasion = null; renderGrid(btn.dataset.cat); $('#productos').scrollIntoView({ behavior: 'smooth' }); }
  });
}

function renderBeneficios() {
  const box = document.getElementById('benefits-grid');
  const items = CATALOGO?.config?.beneficios;
  if (!box || !items?.length) return;
  box.innerHTML = items.map(b => `<div class="benefit-pill">${b}</div>`).join('');
}

function renderOcasiones() {
  const occ = CATALOGO?.config?.ocasiones || [];
  const sec = document.getElementById('ocasiones');
  if (!occ.length) { sec?.remove(); return; }
  $('#occ-grid').innerHTML = occ.map(o => `
    <button type="button" class="occ-card" data-occ="${o.id}">
      <img src="${o.img}" alt="${escapa(o.nombre)}" loading="lazy" width="280" height="200">
      <span class="occ-info"><strong>${o.nombre}</strong><span>${o.desc}</span></span>
    </button>`).join('');
  $('#occ-grid').onclick = e => {
    const btn = e.target.closest('.occ-card');
    if (!btn) return;
    const o = occ.find(x => x.id === btn.dataset.occ);
    if (!o) return;
    filtroOcasion = new Set(o.productos);
    filtroCat = 'todos';
    filtroBusqueda = '';
    gridMostrar = PAGE_SIZE;
    renderGrid('todos');
    $('#productos').scrollIntoView({ behavior: 'smooth' });
    const note = document.getElementById('occasion-note');
    if (note) note.textContent = `Mostrando ideas para: ${o.nombre}`;
    else {
      const p = document.createElement('p');
      p.id = 'occasion-note';
      p.className = 'occasion-note';
      p.textContent = `Mostrando ideas para: ${o.nombre} · `;
      const a = document.createElement('button');
      a.type = 'button';
      a.className = 'link-btn';
      a.textContent = 'ver todo el catálogo';
      a.onclick = () => { filtroOcasion = null; p.remove(); renderGrid('todos'); };
      p.appendChild(a);
      document.querySelector('#productos .sec-title')?.after(p);
    }
  };
}

function renderWhy() {
  const items = [
    { icon: '✨', title: 'Vista previa real', text: 'Ves tu grabado o foto antes de pagar — cero sorpresas al recibir.' },
    { icon: '🎁', title: 'Estuche incluido', text: 'Cada pieza llega lista para regalar, con tarjeta escrita a mano si quieres.' },
    { icon: '🤝', title: 'Hecho a mano en Cali', text: 'Taller propio con atención humana por WhatsApp y Magui, nuestra asistente.' },
    { icon: '🚚', title: 'Envío a todo Colombia', text: 'Gratis desde $150.000 con Interrapidísimo o Servientrega.' },
  ];
  const box = document.getElementById('why-grid');
  if (!box) return;
  box.innerHTML = items.map(i => `
    <div class="why-card">
      <span class="why-icon" aria-hidden="true">${i.icon}</span>
      <h3>${i.title}</h3>
      <p>${i.text}</p>
    </div>`).join('');
}

function renderReviewsCarousel() {
  const wrap = document.getElementById('reviews-carousel');
  const sec = document.getElementById('resenas');
  if (!wrap || !RESENAS.length) { sec?.classList.add('hidden'); return; }
  const top = [...RESENAS].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 14);
  wrap.innerHTML = top.map(r => {
    const p = CATALOGO.productos.find(x => x.id === r.producto);
    const txt = r.comentario?.trim() || '¡Me encantó mi pieza! 💛';
    return `<article class="review-slide">
      <div class="review-slide-stars">${estrellasHtml(r.estrellas, '')}</div>
      <p>“${escapa(txt)}”</p>
      <footer><strong>${escapa(r.nombre)}</strong>${p ? ` · ${escapa(p.nombre)}` : ''}</footer>
    </article>`;
  }).join('');
  let i = 0;
  const slides = () => wrap.querySelectorAll('.review-slide');
  const vis = () => Math.max(1, Math.floor(wrap.clientWidth / 300));
  const go = dir => {
    const n = slides().length;
    if (!n) return;
    i = (i + dir + n) % n;
    const slide = slides()[i];
    if (slide) wrap.scrollTo({ left: slide.offsetLeft - 8, behavior: 'smooth' });
  };
  if (!wrap.parentElement.querySelector('.rev-nav')) {
    const nav = document.createElement('div');
    nav.className = 'rev-nav';
    nav.innerHTML = '<button type="button" class="rev-btn rev-prev" aria-label="Reseña anterior">‹</button><button type="button" class="rev-btn rev-next" aria-label="Siguiente reseña">›</button>';
    wrap.parentElement.appendChild(nav);
    nav.querySelector('.rev-prev').onclick = () => go(-vis());
    nav.querySelector('.rev-next').onclick = () => go(vis());
  }
  setInterval(() => go(vis()), 7000);
}

function renderBlog() {
  const box = document.getElementById('blog-grid');
  if (!box) return;
  fetch('/api/blog').then(r => r.json()).then(data => {
    const arts = (data.articulos || []).slice(0, 3);
    if (!arts.length) { document.getElementById('blog')?.classList.add('hidden'); return; }
    box.innerHTML = arts.map(a => `
      <a class="blog-card" href="/blog/${a.slug}">
        <time datetime="${a.fecha}">${a.fecha}</time>
        <h3>${escapa(a.titulo)}</h3>
        <p>${escapa(a.resumen)}</p>
        <span class="blog-link">Leer guía →</span>
      </a>`).join('');
  }).catch(() => document.getElementById('blog')?.classList.add('hidden'));
}

function handlePagoQuery() {
  const q = new URLSearchParams(location.search);
  if (q.get('pago') !== 'ok') return;
  const id = q.get('id') || '';
  history.replaceState({}, '', location.pathname + location.hash);
  abrirInfo('¡Pago recibido!', `
    <p>Tu pedido <strong>${escapa(id)}</strong> quedó registrado.</p>
    <p>Te escribiremos por WhatsApp para confirmar personalización y envío. Si tienes fotos o cambios en el grabado, envíalos de una vez 💛</p>`);
}

function initWaPopup() {
  const pop = document.getElementById('wa-popup');
  if (!pop || sessionStorage.getItem('magillas_wa_pop')) return;
  const cfg = CATALOGO?.config;
  const btn = document.getElementById('wa-popup-btn');
  if (btn && cfg) btn.href = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent('Hola Magillas 👋 Tengo una duda antes de comprar')}`;
  const show = () => {
    if (sessionStorage.getItem('magillas_wa_pop')) return;
    pop.hidden = false;
    sessionStorage.setItem('magillas_wa_pop', '1');
  };
  setTimeout(show, 28000);
  document.getElementById('wa-popup-close')?.addEventListener('click', () => { pop.hidden = true; });
  pop.addEventListener('click', e => { if (e.target === pop) pop.hidden = true; });
}

let filtroOcasion = null;
let filtroBusqueda = '';
let filtroOrden = 'default';
const PAGE_SIZE = 24;
let gridMostrar = PAGE_SIZE;

function productosFiltrados(cat) {
  let prods = CATALOGO.productos;
  if (filtroOcasion) prods = prods.filter(p => filtroOcasion.has(p.id));
  else if (cat === 'ofertas') prods = prods.filter(p => p.categoria === 'ofertas' || p.precioAntes);
  else if (cat !== 'todos') prods = prods.filter(p => p.categoria === cat);
  if (filtroBusqueda) {
    prods = prods.filter(p =>
      p.nombre.toLowerCase().includes(filtroBusqueda) ||
      p.desc.toLowerCase().includes(filtroBusqueda) ||
      nombreCat(p.categoria).toLowerCase().includes(filtroBusqueda)
    );
  }
  if (filtroOrden === 'price-asc') prods = [...prods].sort((a, b) => a.precio - b.precio);
  else if (filtroOrden === 'price-desc') prods = [...prods].sort((a, b) => b.precio - a.precio);
  else if (filtroOrden === 'name') prods = [...prods].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  else prods = [...prods].sort((a, b) => (b.destacado || 0) - (a.destacado || 0) || a.nombre.localeCompare(b.nombre, 'es'));
  return prods;
}

function gridFoot() {
  let foot = document.getElementById('grid-foot');
  if (!foot) {
    foot = document.createElement('div');
    foot.id = 'grid-foot';
    foot.className = 'grid-foot';
    document.getElementById('grid').after(foot);
  }
  return foot;
}

function renderChips() {
  const cats = [{ id: 'todos', nombre: 'Todos' }, ...CATALOGO.categorias];
  $('#chips').innerHTML = cats.map(c => `<button class="chip${c.id === 'ofertas' ? ' chip-sale' : ''}" data-cat="${c.id}" aria-pressed="false">${c.nombre}</button>`).join('');
  $('#chips').addEventListener('click', e => {
    if (e.target.dataset.cat) { filtroOcasion = null; document.getElementById('occasion-note')?.remove(); filtroCat = e.target.dataset.cat; renderGrid(filtroCat); }
  });
  const search = document.getElementById('search-products');
  if (search) search.addEventListener('input', () => { filtroBusqueda = search.value.trim().toLowerCase(); renderGrid(filtroCat); });
  const sort = document.getElementById('sort-products');
  if (sort) sort.addEventListener('change', () => { filtroOrden = sort.value; renderGrid(filtroCat); });
}

function cardHtml(p, i) {
  const stagger = Math.min(i, 12);
  const img2 = p.imgs?.[1] || p.img;
  return `
    <article class="card" style="--i:${stagger}">
      ${p.badge ? `<span class="badge-best">${p.badge}</span>` : ''}
      ${p.precioAntes ? '<span class="badge-sale">Oferta</span>' : ''}
      <div class="card-imgwrap" data-open="${p.id}">
        <img class="card-img" src="${p.img}" data-hover="${img2}" alt="${p.nombre}" loading="lazy">
      </div>
      <div class="card-body">
        <span class="card-cat">${nombreCat(p.categoria)}</span>
        <h3 class="card-name" data-open="${p.id}">${p.nombre}</h3>
        ${p.custom ? '<span class="badge-custom">Personalizable</span>' : ''}
        ${p.stock > 0 && p.stock <= 3 ? `<span class="stock-low">🔥 ¡Quedan ${p.stock}!</span>` : ''}
        ${p.stock === 0 ? '<span class="stock-out">Agotado</span>' : ''}
        ${ratingDe(p.id)}
        <span class="card-price">${p.precioAntes ? `<s class="price-old">${cop(p.precioAntes)}</s> ` : ''}${cop(p.precio)}</span>
        <div class="card-actions">
          <button class="btn btn-gold btn-sm" data-open="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>${p.custom ? 'Personalizar' : 'Ver'}</button>
          <button class="btn btn-line btn-sm" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Añadir</button>
        </div>
      </div>
    </article>`;
}

function renderFeatured() {
  const box = document.getElementById('grid-featured');
  if (!box) return;
  const prods = CATALOGO.productos.filter(p => p.destacado || p.badge).slice(0, 12);
  box.innerHTML = prods.map((p, i) => cardHtml(p, i)).join('');
  wireCardHovers(box);
}

function renderGrid(cat) {
  filtroCat = cat;
  gridMostrar = PAGE_SIZE;
  document.querySelectorAll('.chip').forEach(ch => {
    const activo = ch.dataset.cat === cat;
    ch.classList.toggle('active', activo);
    ch.setAttribute('aria-pressed', activo);
  });
  pintarGrid();
}

function pintarGrid() {
  const prods = productosFiltrados(filtroCat);
  if (!prods.length) {
    $('#grid').innerHTML = `<div class="estado-error">
      <p>${filtroBusqueda ? 'No encontramos ese producto 🔍' : 'Todavía no tenemos piezas en esta categoría 💛'}</p>
      <button class="btn btn-line btn-sm" data-cat-reset>Ver todo el catálogo</button></div>`;
    gridFoot().innerHTML = '';
    $('#grid').querySelector('[data-cat-reset]').onclick = () => { filtroBusqueda = ''; const s = document.getElementById('search-products'); if (s) s.value = ''; renderGrid('todos'); };
    return;
  }
  const visibles = prods.slice(0, gridMostrar);
  const anchor = gridMostrar > PAGE_SIZE ? document.getElementById('grid-foot')?.offsetTop : null;
  $('#grid').innerHTML = visibles.map((p, i) => cardHtml(p, i)).join('');
  wireCardHovers($('#grid'));
  if (anchor != null) window.scrollTo({ top: anchor - 80, behavior: 'instant' in window ? 'instant' : 'auto' });
  const foot = gridFoot();
  if (gridMostrar < prods.length) {
    foot.innerHTML = `<button type="button" class="btn btn-line" id="btn-more">Ver más (${prods.length - gridMostrar} restantes)</button>`;
    $('#btn-more').onclick = () => { gridMostrar += PAGE_SIZE; pintarGrid(); };
  } else {
    foot.innerHTML = prods.length > PAGE_SIZE ? `<p class="fine">Mostrando los ${prods.length} productos</p>` : '';
  }
}
const nombreCat = id => (CATALOGO.categorias.find(c => c.id === id) || {}).nombre || '';
// deshabilita el botón mientras corre la petición: evita envíos dobles y da señal de "procesando"
async function conBoton(btn, fn) {
  const txt = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try { return await fn(); }
  finally { btn.disabled = false; btn.textContent = txt; }
}
// escape de contenido de usuario (reseñas, etc.)
const escapa = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

document.addEventListener('click', e => {
  const open = e.target.closest('[data-open]');
  if (open) return openProduct(open.dataset.open);
  const chatAdd = e.target.closest('[data-chat-add]');
  if (chatAdd) {
    const p = CATALOGO.productos.find(x => x.id === chatAdd.dataset.chatAdd);
    if (!p) return;
    if (esPersonalizable(p)) { openProduct(p.id); return; }
    addToCart(p.id, {}, 1);
    trackEvent('chat_add_to_cart', { item_id: p.id });
    openCart();
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    const p = CATALOGO.productos.find(x => x.id === add.dataset.add);
    if (p && esPersonalizable(p)) {
      openProduct(p.id);
      return;
    }
    addToCart(add.dataset.add, {}, 1);
    const txt = add.textContent;
    add.textContent = '✓ Añadido';
    add.classList.add('ok');
    setTimeout(() => { add.textContent = txt; add.classList.remove('ok'); }, 1100);
    setTimeout(openCart, 320);
  }
});

// ── modal producto / preview estilo Zepto ──
function estiloCapa(c, prev) {
  const font = c.font || prev.font || prev.fonts?.[0]?.f || "'Cormorant Garamond', serif";
  const color = c.color || prev.color || '#2a2210';
  const size = c.size || prev.size || 4;
  return `left:${c.x}%;top:${c.y}%;--rot:${c.rot || 0}deg;font-family:${font};font-size:calc(${size}cqw * var(--size-mul, 1));color:${color}`;
}

function overlayPreviewHtml(prev) {
  if (!prev) return '';
  const tipo = prev.tipo || 'text';
  let html = '';
  if (prev.fotoZone) {
    html += `<div class="prev-foto-zone" id="prev-foto-zone" hidden style="left:${prev.fotoZone.x}%;top:${prev.fotoZone.y}%;width:${prev.fotoZone.w}%;height:${prev.fotoZone.h}%"><img id="prev-foto-img" alt="Tu foto"></div>`;
  }
  (prev.fotoZones || []).forEach((z, i) => {
    html += `<div class="prev-foto-zone" id="prev-foto-zone-${i}" hidden style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%"><img class="prev-foto-img" data-fz="${i}" alt="Tu foto"></div>`;
  });
  if (prev.capas?.length) {
    html += prev.capas.map((c, i) =>
      `<span class="prev-text prev-engrave" id="prev-text-${i}" data-campo="${c.campo}" hidden style="${estiloCapa(c, prev)}">${c.placeholder || ''}</span>`
    ).join('');
  } else if (tipo !== 'foto') {
    html += `<span class="prev-text prev-engrave" id="prev-text" hidden style="${estiloCapa(prev, prev)}">${prev.placeholder || ''}</span>`;
  }
  if (tipo === 'foto' && !prev.fotoZone && !prev.fotoZones?.length) {
    html += `<span class="prev-foto-badge" id="prev-foto-badge" hidden>📷 Tu foto aquí</span>`;
  }
  html += `<span class="prev-hint" id="prev-hint" hidden>${tipo === 'foto' || prev.fotoZone ? '✨ Sube tu foto y mírala en la pieza' : '✨ Escribe tu texto y míralo en la foto'}</span>`;
  return html;
}

function galeriaHtml(p, prev) {
  const imgs = p.imgs?.length ? p.imgs : [p.img];
  const previewIdx = prev?.imgIndex != null ? Math.min(prev.imgIndex, imgs.length - 1) : 0;
  const start = previewIdx;
  const display = prev?.displayImg || imgs[start];
  const nav = imgs.length > 1 ? `
      <button type="button" class="m-gal-nav m-gal-prev" aria-label="Imagen anterior">‹</button>
      <button type="button" class="m-gal-nav m-gal-next" aria-label="Imagen siguiente">›</button>` : '';
  const thumbs = imgs.length > 1 ? `
    <div class="m-thumbs" role="tablist" aria-label="Galería del producto">
      ${imgs.map((src, i) => `<button type="button" class="m-thumb ${!prev?.mockup && i === start ? 'active' : ''}" role="tab" aria-selected="${!prev?.mockup && i === start}" data-idx="${i}"><img src="${src}" alt="Vista ${i + 1}"></button>`).join('')}
      ${prev?.mockup ? `<button type="button" class="m-thumb m-thumb-preview ${prev?.mockup ? 'active' : ''}" role="tab" aria-selected="true" data-idx="preview" title="Vista previa">✨</button>` : ''}
    </div>` : (prev?.mockup ? `
    <div class="m-thumbs"><button type="button" class="m-thumb m-thumb-preview active" data-idx="preview" title="Vista previa">✨ Vista previa</button></div>` : '');
  return `
    <div class="m-gallery" data-start="${start}" data-preview-idx="${previewIdx}" data-has-mockup="${prev?.mockup ? '1' : ''}">
      <div class="m-gallery-main">
        ${nav}
        <div class="m-imgwrap">
          <img id="m-gal-img" src="${display}" alt="${p.nombre}">
          ${overlayPreviewHtml(prev)}
        </div>
      </div>
      ${thumbs}
    </div>`;
}

function wirePreview(p, prev) {
  if (!prev) return;
  const imgs = p.imgs?.length ? p.imgs : [p.img];
  const gal = document.querySelector('.m-gallery');
  const previewIdx = prev.imgIndex != null ? +prev.imgIndex : 0;
  const hasMockup = !!prev.mockup;
  let slide = hasMockup ? 'preview' : (+gal?.dataset.start || 0);
  const onPreviewSlide = () => hasMockup ? slide === 'preview' : slide === previewIdx;

  const syncPreview = () => {
    const on = onPreviewSlide();
    gal?.querySelectorAll('.prev-text, .prev-hint, .prev-foto-badge, .prev-foto-zone').forEach(el => { el.hidden = !on; });
    gal?.querySelector('.m-thumb-preview')?.classList.toggle('active', slide === 'preview');
  };

  const goSlide = idx => {
    if (idx === 'preview') {
      slide = 'preview';
      $('#m-gal-img').src = prev.displayImg || prev.mockup;
    } else {
      slide = (idx + imgs.length) % imgs.length;
      $('#m-gal-img').src = imgs[slide];
    }
    gal?.querySelectorAll('.m-thumb:not(.m-thumb-preview)').forEach((t, i) => {
      const on = slide !== 'preview' && i === slide;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    syncPreview();
  };

  gal?.querySelector('.m-gal-prev')?.addEventListener('click', () => {
    if (slide === 'preview') goSlide(imgs.length - 1);
    else if (slide === 0 && hasMockup) goSlide('preview');
    else goSlide(slide - 1);
  });
  gal?.querySelector('.m-gal-next')?.addEventListener('click', () => {
    if (slide === 'preview') goSlide(0);
    else if (slide === imgs.length - 1 && hasMockup) goSlide('preview');
    else goSlide(slide + 1);
  });
  gal?.querySelectorAll('.m-thumb').forEach(t => t.addEventListener('click', () => goSlide(t.dataset.idx === 'preview' ? 'preview' : +t.dataset.idx)));
  if (hasMockup) goSlide('preview');
  else syncPreview();

  const ajustar = el => {
    if (!el || el.hidden) return;
    const capa = prev.capas?.find(c => c.campo === el.dataset.campo) || prev;
    const anchoMax = (capa.anchoMax || prev.anchoMax || 30) / 100 * el.parentElement.clientWidth;
    const real = el.scrollWidth;
    el.style.setProperty('--fit', real > anchoMax ? Math.max(.35, anchoMax / real) : 1);
  };
  const ajustarTodos = () => document.querySelectorAll('.prev-text').forEach(ajustar);

  let sizeMul = 1;
  const wrap = document.querySelector('.m-imgwrap');
  const setSizeMul = mul => {
    sizeMul = Math.min(1.6, Math.max(.55, mul));
    wrap?.style.setProperty('--size-mul', sizeMul);
    requestAnimationFrame(ajustarTodos);
  };
  $('#sz-minus')?.addEventListener('click', () => setSizeMul(sizeMul - .1));
  $('#sz-plus')?.addEventListener('click', () => setSizeMul(sizeMul + .1));

  const bindText = (campo, elId) => {
    const inp = document.querySelector(`#modal-body [data-custom="${campo}"]`);
    const el = elId ? document.getElementById(elId) : $('#prev-text');
    if (!inp || !el) return;
    const ph = prev.capas?.find(c => c.campo === campo)?.placeholder || prev.placeholder || '';
    inp.addEventListener('input', () => { el.textContent = inp.value || ph; ajustar(el); });
    if (inp.value) { el.textContent = inp.value; ajustar(el); }
  };

  if (prev.capas?.length) {
    prev.capas.forEach((c, i) => bindText(c.campo, `prev-text-${i}`));
    requestAnimationFrame(ajustarTodos);
  } else if (prev.tipo !== 'foto') {
    bindText(prev.campo);
    requestAnimationFrame(ajustarTodos);
  }

  document.querySelectorAll('.font-chip').forEach(ch => ch.onclick = () => {
    document.querySelectorAll('.font-chip').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
    ch.classList.add('active');
    ch.setAttribute('aria-pressed', 'true');
    document.querySelectorAll('.prev-text').forEach(t => { t.style.fontFamily = ch.dataset.font; });
    ajustarTodos();
  });

  const setFotoPreview = dataUrl => {
    const main = document.getElementById('prev-foto-img');
    if (main) main.src = dataUrl;
    document.querySelectorAll('.prev-foto-img').forEach(img => { img.src = dataUrl; });
    const badge = $('#prev-foto-badge');
    if (badge) badge.textContent = dataUrl ? '📷 Foto cargada' : '📷 Tu foto aquí';
  };
  const fotoRefBox = document.getElementById('foto-ref-box');
  const fotoRefImg = document.getElementById('foto-ref-img');
  const fotoQaMsg = document.getElementById('foto-qa-msg');
  const bindFotoInput = inp => {
    inp.addEventListener('change', async e => {
      const f = e.target.files?.[0];
      const err = e.target.closest('.m-field')?.querySelector('.m-err');
      const campo = e.target.dataset.custom || 'foto';
      if (!f) return;
      try {
        const dataUrl = await comprimirFoto(f);
        const issues = await qaFoto(dataUrl);
        guardarFotoRef(p.id, campo, dataUrl);
        setFotoPreview(dataUrl);
        if (fotoRefBox && fotoRefImg && !(prev?.fotoZone || prev?.fotoZones?.length)) {
          fotoRefBox.hidden = false;
          fotoRefImg.src = dataUrl;
        }
        if (fotoQaMsg) fotoQaMsg.textContent = issues.length ? '⚠️ ' + issues.join(' ') : '✓ Foto lista para producción.';
        if (err) err.textContent = '';
        if (hasMockup) goSlide('preview');
        else if (!onPreviewSlide()) goSlide(previewIdx);
      } catch {
        if (err) err.textContent = 'La imagen debe ser JPG/PNG y máximo 5 MB.';
        e.target.value = '';
      }
    });
  };
  document.querySelectorAll('#modal-body [data-custom][type="file"]').forEach(bindFotoInput);
  const prevFoto = leerFotoRef(p.id, 'foto') || leerFotoRef(p.id, 'foto_ref');
  if (prevFoto) {
    setFotoPreview(prevFoto);
    if (fotoRefBox && fotoRefImg) { fotoRefBox.hidden = false; fotoRefImg.src = prevFoto; }
  }

  const msgInp = document.querySelector(`#modal-body [data-custom="${prev.campo}"]`);
  msgInp?.addEventListener('input', () => {
    const badge = $('#prev-foto-badge');
    if (badge && prev.tipo === 'foto') badge.textContent = msgInp.value.trim() ? `💬 ${msgInp.value.trim()}` : '📷 Tu foto aquí';
  });

  return { ajustarTodos, goSlide, previewIdx, hasMockup };
}

function openProduct(id) {
  modalAbort?.abort();
  modalAbort = new AbortController();
  const { signal } = modalAbort;

  const p = CATALOGO.productos.find(x => x.id === id);
  if (!p) return;
  const agotado = p.stock === 0;
  const prev = p.preview;
  const imgHtml = galeriaHtml(p, prev);
  $('#modal-body').innerHTML = `
    ${imgHtml}
    <div class="m-info">
      <span class="card-cat">${nombreCat(p.categoria)}</span>
      <h3>${p.nombre}</h3>
      <span class="m-price">${p.precioAntes ? `<s class="price-old">${cop(p.precioAntes)}</s> ` : ''}${cop(p.precio)}</span>
      ${ratingDe(p.id)}
      <p class="m-desc">${p.desc}</p>
      ${(() => {
        const sp = CATALOGO.especificaciones?.[p.id];
        if (!sp) return '';
        const labels = { material: 'Material', cadena: 'Cadena', dije: 'Dije', incluye: 'Incluye', peso: 'Peso' };
        return `<details class="m-specs"><summary>Ficha técnica</summary><dl class="specs-dl">${Object.entries(sp).map(([k, v]) =>
          `<dt>${labels[k] || k}</dt><dd>${escapa(v)}</dd>`).join('')}</dl></details>`;
      })()}
      ${p.categoria === 'pulseras-neopreno' || p.categoria === 'pulseras-tejidas' || p.categoria === 'brazaletes' ? '<p class="m-lead">📏 <a href="#" id="link-tallas">Guía de tallas</a> — pulseras ajustables</p>' : ''}
      ${p.custom ? '<p class="m-lead">⏱️ Hecho a pedido: 3–5 días hábiles + envío</p>' : '<p class="m-lead">⏱️ Preparación: 1–2 días hábiles + envío</p>'}
      ${prev && prev.tipo !== 'foto' ? `<div class="m-field m-size-row"><label>Tamaño del texto</label><div class="size-ctrl"><button type="button" id="sz-minus" aria-label="Reducir">−</button><span class="size-preview" aria-hidden="true">a<span>A</span>A</span><button type="button" id="sz-plus" aria-label="Aumentar">+</button></div></div>` : ''}
      ${prev?.fonts ? `<div class="m-field"><label>Tipografía</label><select id="font-select" class="font-select">${prev.fonts.map((f, i) => {
        const active = (prev.font && f.f === prev.font) || (!prev.font && i === 0);
        return `<option value="${f.f}" data-fn="${f.n}" ${active ? 'selected' : ''}>${f.n}</option>`;
      }).join('')}</select><div class="font-chips">${prev.fonts.map((f, i) => {
        const active = (prev.font && f.f === prev.font) || (!prev.font && i === 0);
        return `<button type="button" class="font-chip ${active ? 'active' : ''}" aria-pressed="${active}" data-font="${f.f}" data-fn="${f.n}" style="font-family:${f.f}">${f.n}</button>`;
      }).join('')}</div></div>` : ''}
      ${(p.custom || []).map(c =>
        c.type === 'nota' ? `<p class="m-nota">📸 ${c.label}</p>` :
        c.type === 'file' ? `<div class="m-field"><label>${c.label}${c.opcional ? '' : ' *'}</label><input type="file" data-opcional="${c.opcional ? '1' : ''}" accept="image/jpeg,image/png,image/webp" data-custom="${c.id}"><p class="m-lead">JPG o PNG · máx. 5 MB</p><p class="m-err" role="alert"></p></div>` :
        c.type === 'select' ? `<div class="m-field"><label>${c.label}</label><select data-custom="${c.id}">${c.options.map(o => `<option>${o}</option>`).join('')}</select></div>` :
        `<div class="m-field"><label>${c.label}${p.preview && c.id === (p.preview.campo || 'nombre') ? ' *' : ''}</label><input type="text" data-custom="${c.id}" maxlength="80" placeholder="Escríbelo aquí..."><p class="m-err" role="alert"></p></div>`
      ).join('')}
      <div class="foto-ref-box" id="foto-ref-box" hidden>
        <img id="foto-ref-img" alt="Vista previa de tu foto" width="120" height="120">
        <p id="foto-qa-msg" class="foto-qa m-lead" role="status"></p>
      </div>
      <p class="m-err" id="m-form-err" role="alert"></p>
      <div class="m-qty">
        <button id="q-minus">−</button><span id="q-val">1</span><button id="q-plus">+</button>
      </div>
      <div class="m-actions">
        <button class="btn btn-dark" id="m-add" ${agotado ? 'disabled' : ''}>${agotado ? 'Agotado' : 'Añadir al carrito — '}<span id="m-total">${agotado ? '' : cop(p.precio)}</span></button>
        <button class="btn btn-dark btn-buy" id="m-buy" ${agotado ? 'disabled' : ''}>Comprar ahora</button>
        <button class="btn btn-line btn-sm" id="m-wa" title="Consultar por WhatsApp">WhatsApp</button>
        <button class="btn btn-line btn-sm" id="m-share" title="Compartir">Compartir ↗</button>
      </div>
      <div class="m-sticky-bar" id="m-sticky">
        <span class="m-sticky-price">${cop(p.precio)}</span>
        <button class="btn btn-dark btn-sm" id="m-sticky-add" ${agotado ? 'disabled' : ''}>Añadir al carrito</button>
      </div>
      ${(() => {
        const rel = CATALOGO.productos.filter(x => x.categoria === p.categoria && x.id !== p.id).slice(0, 2);
        return rel.length ? `<div class="m-rel"><span class="card-cat">Combínalo con</span>${rel.map(r =>
          `<button class="rel-item" data-open="${r.id}"><img src="${r.img}" alt=""><span>${r.nombre}<br><strong>${cop(r.precio)}</strong></span></button>`).join('')}</div>` : '';
      })()}
    </div>
    <div class="m-reviews">
      <h4>Reseñas ${resenasDe(p.id).length ? `· ${ratingDe(p.id)}` : ''}</h4>
      ${resenasDe(p.id).map(r => `
        <div class="review">
          <div class="review-head"><strong>${escapa(r.nombre)}</strong> ${estrellasHtml(r.estrellas, '')}</div>
          ${r.comentario ? `<p>${escapa(r.comentario)}</p>` : ''}
        </div>`).join('') || '<p class="m-lead">Aún no hay reseñas de esta pieza. ¡Sé la primera! 💛</p>'}
      <details class="review-form-box">
        <summary>Escribir una reseña</summary>
        <div class="review-form">
          <input id="rv-nombre" placeholder="Tu nombre" maxlength="60">
          <select id="rv-estrellas">
            <option value="5">★★★★★ Me encantó</option><option value="4">★★★★ Muy buena</option>
            <option value="3">★★★ Buena</option><option value="2">★★ Regular</option><option value="1">★ No me gustó</option>
          </select>
          <textarea id="rv-comentario" placeholder="Cuéntanos tu experiencia (opcional)" maxlength="500"></textarea>
          <button class="btn btn-gold btn-sm" id="rv-enviar">Publicar reseña</button>
          <span id="rv-msg" class="m-lead" role="status" aria-live="polite"></span>
        </div>
      </details>
    </div>`;
  abrirOverlay('#overlay-product');
  wirePreview(p, prev);

  document.getElementById('font-select')?.addEventListener('change', e => {
    const opt = e.target.selectedOptions[0];
    document.querySelectorAll('.prev-text').forEach(t => { t.style.fontFamily = opt.value; });
    document.querySelectorAll('.font-chip').forEach(ch => {
      const on = ch.dataset.font === opt.value;
      ch.classList.toggle('active', on);
      ch.setAttribute('aria-pressed', on);
    });
  });

  const cfg = CATALOGO.config;
  document.getElementById('m-wa')?.addEventListener('click', () => {
    const msg = encodeURIComponent(`Hola Magillas 👋 Me interesa el *${p.nombre}* (${cop(p.precio)}). ${location.origin}/p/${p.id}`);
    window.open(`https://wa.me/${cfg.whatsapp}?text=${msg}`, '_blank', 'noopener');
  });
  // compartir producto
  document.getElementById('m-share')?.addEventListener('click', async () => {
    const link = location.origin + '/p/' + p.id;
    if (navigator.share) { try { await navigator.share({ title: p.nombre, url: link }); } catch { } }
    else { await navigator.clipboard.writeText(link); $('#m-share').textContent = '¡Link copiado! ✓'; setTimeout(() => $('#m-share').textContent = 'Compartir ↗', 1500); }
  });
  // guía de tallas
  document.getElementById('link-tallas')?.addEventListener('click', e => {
    e.preventDefault();
    abrirInfo('Guía de tallas', `
      <p>Nuestras pulseras son <strong>ajustables</strong> con nudo corredizo: sirven para muñecas de 14 a 22 cm aprox.</p>
      <p>Si la quieres a una medida fija, mide tu muñeca con un metro de costura (o una cuerda que luego mides con regla) y escríbenos la medida en las <strong>notas del pedido</strong>.</p>
      <p>Los collares estándar miden 45 cm + extensor. ¿Otra medida? También por notas o WhatsApp 💛</p>`);
  });
  // reseñas
  document.getElementById('rv-enviar')?.addEventListener('click', async e => {
    const nombre = $('#rv-nombre').value.trim();
    if (!nombre) return $('#rv-msg').textContent = 'Escribe tu nombre.';
    const r = await conBoton(e.target, () => fetch('/api/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto: p.id, nombre, estrellas: +$('#rv-estrellas').value, comentario: $('#rv-comentario').value.trim() })
    }));
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      $('#rv-msg').textContent = data.mensaje || '¡Gracias por tu reseña! 💛';
      if (!data.pendiente) {
        RESENAS = await fetch('/api/reviews').then(x => x.json());
        setTimeout(() => openProduct(p.id), 800);
      }
    } else $('#rv-msg').textContent = 'No se pudo publicar, intenta de nuevo.';
  });
  let qty = 1;
  const stickyEl = document.getElementById('m-sticky');
  const stickyPrice = stickyEl?.querySelector('.m-sticky-price');
  const upd = () => {
    $('#q-val').textContent = qty;
    const total = cop(p.precio * qty);
    $('#m-total').textContent = total;
    if (stickyPrice) stickyPrice.textContent = total;
  };
  $('#q-minus').onclick = () => { if (qty > 1) { qty--; upd(); } };
  $('#q-plus').onclick = () => { qty++; upd(); };

  const validarForm = () => {
    let ok = true;
    $('#m-form-err').textContent = '';
    document.querySelectorAll('#modal-body .m-err').forEach(el => { el.textContent = ''; });
    if (p.preview) {
      const campo = p.preview.campo || 'nombre';
      if (p.preview.tipo !== 'foto' && !p.preview.capas?.length) {
        const inp = document.querySelector(`#modal-body [data-custom="${campo}"]`);
        if (inp && !inp.value.trim()) {
          const errEl = inp.closest('.m-field')?.querySelector('.m-err');
          if (errEl) errEl.textContent = 'Este campo es obligatorio.';
          ok = false;
        }
      }
      if (p.preview.capas?.length) {
        p.preview.capas.forEach(c => {
          const inp = document.querySelector(`#modal-body [data-custom="${c.campo}"]`);
          if (inp && !inp.value.trim()) {
            const errEl = inp.closest('.m-field')?.querySelector('.m-err');
            if (errEl) errEl.textContent = 'Obligatorio.';
            ok = false;
          }
        });
      }
    }
    document.querySelectorAll('#modal-body [data-custom][type="file"]').forEach(inp => {
      const campo = inp.dataset.custom;
      const meta = (p.custom || []).find(c => c.id === campo);
      const req = p.fotoRequerida || (meta && !meta.opcional);
      if (req && !leerFotoRef(p.id, campo)) {
        const errEl = inp.closest('.m-field')?.querySelector('.m-err');
        if (errEl) errEl.textContent = 'Sube una foto para continuar.';
        ok = false;
      }
    });
    return ok;
  };

  const leerCustom = () => {
    const custom = {};
    document.querySelectorAll('#modal-body [data-custom]').forEach(el => {
      if (el.type === 'file') {
        if (leerFotoRef(p.id, el.dataset.custom)) custom[el.dataset.custom] = '✓ adjunta';
        return;
      }
      if (el.tagName === 'SELECT' || el.value?.trim()) custom[el.dataset.custom] = el.value.trim();
    });
    const fontSel = document.querySelector('.font-chip.active') || document.getElementById('font-select')?.selectedOptions[0];
    const hayTexto = Object.keys(custom).some(k => k !== 'foto' && custom[k]);
    if (fontSel && hayTexto) custom.tipografia = fontSel.dataset?.fn || fontSel.textContent;
    return custom;
  };

  const leerFotoThumb = () => {
    for (const c of (p.custom || []).filter(x => x.type === 'file')) {
      const r = leerFotoRef(p.id, c.id);
      if (r) return r;
    }
    return leerFotoRef(p.id, 'foto') || null;
  };

  const addAndMaybeCheckout = (buyNow) => {
    if (agotado) return;
    if (!validarForm()) {
      $('#m-form-err').textContent = 'Completa los campos marcados antes de continuar.';
      return;
    }
    const custom = leerCustom();
    const fotoThumb = leerFotoThumb();
    addToCart(p.id, custom, qty, fotoThumb);
    cerrarOverlay($('#overlay-product'));
    openCart();
    if (buyNow) {
      setTimeout(() => {
        document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('f-nombre')?.focus();
      }, 200);
    }
  };
  $('#m-add').onclick = () => addAndMaybeCheckout(false);
  $('#m-buy')?.addEventListener('click', () => addAndMaybeCheckout(true));
  $('#m-sticky-add')?.addEventListener('click', () => addAndMaybeCheckout(false));
  upd();

  const modal = document.querySelector('#overlay-product .modal');
  const syncSticky = () => {
    if (!stickyEl || !modal) return;
    const actions = document.querySelector('.m-actions');
    if (!actions) return;
    const fuera = actions.getBoundingClientRect().top > innerHeight - 72;
    stickyEl.classList.toggle('vis', fuera);
  };
  if (stickyEl && modal) {
    syncSticky();
    modal.addEventListener('scroll', syncSticky, { passive: true, signal });
    addEventListener('resize', syncSticky, { signal });
  }
}

// ── carrito ──
function addToCart(id, custom, qty, fotoThumb = null) {
  const p = CATALOGO.productos.find(x => x.id === id);
  if (!p || p.stock === 0) return;
  const key = id + JSON.stringify(custom) + (fotoThumb ? ':f' : '');
  const existing = cart.find(i => i.key === key);
  if (existing) existing.qty += qty;
  else cart.push({ key, id, nombre: p.nombre, precio: p.precio, img: p.img, custom, qty, fotoThumb });
  saveCart();
}
function addUpsell(id) {
  const p = CATALOGO.productos.find(x => x.id === id);
  if (!p || p.stock === 0) return;
  addToCart(id, {}, 1);
  trackEvent('add_upsell', { item_id: id });
}

function saveCart() {
  localStorage.setItem('magillas_cart', JSON.stringify(cart));
  renderCartBadge(); renderCart();
}
function renderCartBadge() {
  const badge = $('#cart-count');
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const subio = total > (+badge.textContent || 0);
  badge.textContent = total;
  if (subio) {
    badge.classList.add('bump');
    badge.addEventListener('animationend', () => badge.classList.remove('bump'), { once: true });
  }
}
const subtotal = () => cart.reduce((s, i) => s + i.precio * i.qty, 0);

function costoEnvio(envioId, sub) {
  const e = CATALOGO.config.envios.find(x => x.id === envioId);
  if (!e) return 0;
  if (e.id === 'nacional' && sub >= CATALOGO.config.envioGratisDesde) return 0;
  return e.precio;
}

let envioSel = 'nacional';
function renderCart() {
  const box = $('#cart-items');
  if (!cart.length) {
    box.innerHTML = `<p class="cart-empty">Tu carrito está vacío.<br>Los detalles bonitos te esperan 💛<br><br>
      <button class="btn btn-gold btn-sm" data-close>Seguir comprando</button></p>`;
    $('#cart-foot').innerHTML = '';
    return;
  }
  box.innerHTML = cart.map((i, idx) => `
    <div class="cart-item">
      <img src="${i.img}" alt="">
      <div>
        <div class="ci-name">${i.nombre}</div>
        ${Object.entries(i.custom).map(([k, v]) => `<div class="ci-custom">${escapa(labelCustom(k))}: ${escapa(v)}</div>`).join('')}
        <div class="ci-qty">
          <button data-q="-1" data-i="${idx}">−</button> ${i.qty} <button data-q="1" data-i="${idx}">+</button>
          &nbsp;<button class="ci-del" data-del="${idx}">quitar</button>
        </div>
      </div>
      <strong>${cop(i.precio * i.qty)}</strong>
    </div>`).join('');

  const sub = subtotal();
  const desc = cupon ? Math.round(sub * cupon.pct / 100) : 0;
  const subDesc = sub - desc;
  const envio = costoEnvio(envioSel, subDesc);
  const total = subDesc + envio;
  const falta = CATALOGO.config.envioGratisDesde - subDesc;
  const pagosOnline = !!CATALOGO.config.pagosWompi;
  const addiOk = total >= (CATALOGO.config.addiDesde || 100000);
  $('#cart-foot').innerHTML = `
    <div class="tot-row"><span>Subtotal</span><span>${cop(sub)}</span></div>
    ${desc ? `<div class="tot-row desc-row"><span>Cupón ${cupon.codigo} (−${cupon.pct}%)</span><span>−${cop(desc)}</span></div>` : ''}
    <div class="tot-row"><span>Envío</span><span>${envio === 0 ? 'Gratis 🎉' : cop(envio)}</span></div>
    <div class="tot-row total"><span>Total</span><span>${cop(total)}</span></div>
    ${upsellHtml()}
    <div class="cupon-row">
      <input id="f-cupon" placeholder="¿Tienes un cupón?" maxlength="30" value="${cupon ? cupon.codigo : ''}">
      <button class="btn btn-line btn-sm" id="btn-cupon">${cupon ? 'Quitar' : 'Aplicar'}</button>
    </div>
    ${envioSel === 'nacional' ? (falta > 0 ? `
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, subDesc / CATALOGO.config.envioGratisDesde * 100)}%"></div></div>
      <p class="free-ship-hint">Te faltan ${cop(falta)} para envío nacional gratis</p>` :
      '<p class="free-ship-hint">🎉 ¡Tienes envío nacional gratis!</p>') : ''}
    <div class="checkout" id="checkout">
      <h4>Datos de entrega</h4>
      <input id="f-nombre" placeholder="Nombre completo *" maxlength="80">
      <input id="f-tel" placeholder="Celular / WhatsApp *" maxlength="20" inputmode="tel">
      <input id="f-email" type="email" placeholder="Correo (confirmación y seguimiento)" maxlength="80">
      <select id="f-envio">${CATALOGO.config.envios.map(e => {
        const precio = costoEnvio(e.id, subDesc);
        return `<option value="${e.id}" ${e.id === envioSel ? 'selected' : ''}>${e.nombre} — ${precio === 0 ? 'gratis' : cop(precio)}</option>`;
      }).join('')}</select>
      <input id="f-ciudad" placeholder="Ciudad *" maxlength="60">
      <input id="f-dir" placeholder="Dirección (si es envío)" maxlength="120">
      <label class="gift-check"><input type="checkbox" id="f-regalo"> 🎁 Es un regalo (va con tarjeta escrita a mano, sin precios)</label>
      <input id="f-recibe" placeholder="Nombre de quien recibe (si va directo)" maxlength="80" hidden>
      <textarea id="f-regalo-msg" placeholder="Mensaje para la tarjeta de regalo..." hidden></textarea>
      <textarea id="f-notas" placeholder="Notas: colores, fotos a grabar, medidas..."></textarea>
      <div class="checkout-actions">
        <button class="btn btn-gold" id="btn-checkout">Confirmar por WhatsApp</button>
        ${pagosOnline ? '<button class="btn btn-dark" id="btn-pay-online" type="button">Pagar en línea (PSE · tarjeta · Nequi)</button>' : ''}
      </div>
      ${addiOk && CATALOGO.config.addi?.activo ? `
        <div class="checkout-addi">
          <button type="button" class="btn btn-line btn-sm" id="btn-addi-wa">Pagar en cuotas con Addi (WhatsApp)</button>
          <a class="checkout-hint" href="${CATALOGO.config.addi.url}" target="_blank" rel="noopener">¿Cómo funciona Addi?</a>
        </div>` : ''}
      <div id="checkout-msg" role="status" aria-live="polite"></div>
    </div>`;
  $('#f-envio').onchange = e => { envioSel = e.target.value; renderCart(); };
  $('#btn-checkout').onclick = checkout;
  $('#btn-pay-online')?.addEventListener('click', checkoutWompi);
  $('#btn-addi-wa')?.addEventListener('click', () => {
    const sub = subtotal();
    const desc = cupon ? Math.round(sub * cupon.pct / 100) : 0;
    const tot = sub - desc + costoEnvio(envioSel, sub - desc);
    const msg = encodeURIComponent(`Hola Magillas 👋 Quiero pagar mi pedido con Addi en cuotas. Total aprox: ${cop(tot)}. Ciudad: ${$('#f-ciudad')?.value || ''}`);
    window.open(`https://wa.me/${CATALOGO.config.whatsapp}?text=${msg}`, '_blank');
    trackEvent('addi_click', { value: tot });
  });
  document.querySelectorAll('[data-upsell-add]').forEach(btn => btn.onclick = () => addUpsell(btn.dataset.upsellAdd));
  $('#f-regalo').onchange = e => { $('#f-regalo-msg').hidden = !e.target.checked; $('#f-recibe').hidden = !e.target.checked; };
  $('#btn-cupon').onclick = async () => {
    if (cupon) { cupon = null; localStorage.setItem('magillas_cupon', 'null'); renderCart(); return; }
    const cod = $('#f-cupon').value.trim().toUpperCase();
    if (!cod) return;
    try {
      const r = await fetch('/api/cupon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: cod }) });
      const d = await r.json();
      if (!r.ok) { $('#f-cupon').value = ''; $('#f-cupon').placeholder = d.error || 'Cupón no válido 😕'; return; }
      cupon = { codigo: d.codigo, pct: d.descuento };
      localStorage.setItem('magillas_cupon', JSON.stringify(cupon));
      renderCart();
    } catch {
      $('#f-cupon').placeholder = 'Error al validar cupón';
    }
  };
}

document.addEventListener('click', e => {
  if (e.target.dataset.q) {
    const i = cart[+e.target.dataset.i];
    i.qty += +e.target.dataset.q;
    if (i.qty <= 0) cart.splice(+e.target.dataset.i, 1);
    saveCart();
  }
  if (e.target.dataset.del !== undefined && e.target.classList.contains('ci-del')) {
    cart.splice(+e.target.dataset.del, 1);
    saveCart();
  }
});

async function leerDatosCheckout() {
  const nombre = $('#f-nombre').value.trim();
  const telefono = $('#f-tel').value.trim();
  const ciudad = $('#f-ciudad').value.trim();
  if (!nombre || !telefono || !ciudad) {
    $('#checkout-msg').innerHTML = '<p class="free-ship-hint" style="color:var(--rojo)">Completa nombre, celular y ciudad.</p>';
    return null;
  }
  const sub = subtotal();
  const desc = cupon ? Math.round(sub * cupon.pct / 100) : 0;
  const envio = costoEnvio(envioSel, sub - desc);
  const esRegalo = $('#f-regalo').checked;
  return {
    nombre, telefono, ciudad,
    email: ($('#f-email')?.value || '').trim(),
    direccion: $('#f-dir').value.trim(),
    envio: envioSel, costoEnvio: envio,
    cupon: cupon ? cupon.codigo : null, descuento: desc,
    regalo: esRegalo, mensajeRegalo: esRegalo ? $('#f-regalo-msg').value.trim() : '',
    recibe: esRegalo ? $('#f-recibe').value.trim() : '',
    notas: $('#f-notas').value.trim(),
    items: cart.map(i => ({
      id: i.id, nombre: i.nombre, qty: i.qty, precio: i.precio,
      custom: i.custom, fotoThumb: i.fotoThumb || undefined,
    })),
    total: sub - desc + envio
  };
}

async function checkout() {
  const pedido = await leerDatosCheckout();
  if (!pedido) return;
  $('#btn-checkout').disabled = true;
  let id = '';
  let serverPedido = null;
  try {
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pedido) });
    const resp = await r.json();
    id = resp.id || '';
    if (!r.ok) {
      $('#checkout-msg').innerHTML = `<p class="free-ship-hint" style="color:var(--rojo)">${resp.error || 'No se pudo registrar el pedido.'}</p>`;
      $('#btn-checkout').disabled = false;
      return;
    }
    serverPedido = resp;
    trackEvent('purchase', { transaction_id: id, value: serverPedido.total || pedido.total });
  } catch {
    $('#checkout-msg').innerHTML = '<p class="free-ship-hint" style="color:var(--rojo)">Error de conexión. Intenta de nuevo.</p>';
    $('#btn-checkout').disabled = false;
    return;
  }

  const items = serverPedido.items || pedido.items;
  const total = serverPedido.total ?? pedido.total;
  const descSrv = serverPedido.descuento ?? pedido.descuento;
  const envioSrv = serverPedido.costoEnvio ?? pedido.costoEnvio;
  const envioTxt = serverPedido.envioNombre || CATALOGO.config.envios.find(e => e.id === envioSel)?.nombre || 'Envío';
  const lineas = items.map(i =>
    `• ${i.qty}x ${i.nombre}${Object.entries(i.custom || {}).filter(([k]) => k !== 'foto').map(([k, v]) => ` (${labelCustom(k)}: ${v})`).join('')}${(i.fotoThumb || i.fotoUrl) ? ' 📷' : ''} — ${cop(i.precio * i.qty)}`);
  const hayFotos = items.some(i => i.fotoThumb || i.fotoUrl);
  const msg = [
    `¡Hola Magillas! 💛 Quiero confirmar mi pedido${id ? ' ' + id : ''}:`,
    '', ...lineas, '',
    `Envío: ${envioTxt} (${envioSrv === 0 ? 'gratis' : cop(envioSrv)})`,
    descSrv ? `Cupón ${serverPedido.cupon || pedido.cupon}: −${cop(descSrv)}` : '',
    `Total: ${cop(total)}`,
    `Nombre: ${pedido.nombre}`, `Ciudad: ${pedido.ciudad}`,
    pedido.direccion ? `Dirección: ${pedido.direccion}` : '',
    pedido.regalo ? `🎁 Es regalo${pedido.recibe ? ' para ' + pedido.recibe : ''}. Tarjeta: "${pedido.mensajeRegalo || 'sin mensaje'}"` : '',
    pedido.notas ? `Notas: ${pedido.notas}` : '',
    hayFotos ? '📷 Las fotos de personalización van adjuntas en este pedido — confírmalas por WhatsApp si falta alguna.' : ''
  ].filter(Boolean).join('\n');

  window.open(`https://wa.me/${CATALOGO.config.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  const pedidoId = id;
  $('#cart-items').innerHTML = `<div class="ok-box">✅ ¡Pedido <strong>${pedidoId}</strong> registrado!<br>Te abrimos WhatsApp para confirmarlo.<br><br>
    <button class="btn btn-gold btn-sm" id="btn-wa-ok">Ya envié por WhatsApp — vaciar carrito</button>
    <button class="btn btn-line btn-sm" id="btn-wa-keep">Seguir editando carrito</button></div>`;
  $('#cart-foot').innerHTML = '';
  document.getElementById('btn-wa-ok')?.addEventListener('click', () => {
    cart = [];
    cupon = null;
    localStorage.setItem('magillas_cupon', 'null');
    saveCart();
    renderCart();
  });
  document.getElementById('btn-wa-keep')?.addEventListener('click', () => renderCart());
  $('#btn-checkout').disabled = false;
}

async function checkoutWompi() {
  const pedido = await leerDatosCheckout();
  if (!pedido) return;
  const btn = document.getElementById('btn-pay-online');
  if (btn) btn.disabled = true;
  $('#checkout-msg').textContent = 'Abriendo pasarela segura…';
  try {
    const r = await fetch('/api/payments/wompi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pedido) });
    const resp = await r.json();
    if (!r.ok) {
      $('#checkout-msg').innerHTML = `<p class="free-ship-hint" style="color:var(--rojo)">${resp.error || 'No se pudo iniciar el pago.'}</p>`;
      if (btn) btn.disabled = false;
      return;
    }
    if (resp.paymentUrl) location.href = resp.paymentUrl;
    else $('#checkout-msg').textContent = 'Pedido registrado. Te contactaremos por WhatsApp.';
  } catch {
    $('#checkout-msg').innerHTML = '<p class="free-ship-hint" style="color:var(--rojo)">Error de conexión. Intenta de nuevo o usa WhatsApp.</p>';
    if (btn) btn.disabled = false;
  }
}

// ── envíos (sección) ──
function renderShipping() {
  $('#ship-grid').innerHTML = CATALOGO.config.envios.map(e => `
    <div class="ship-card">
      <strong>${e.nombre}</strong>
      <span>${e.precio === 0 ? 'Gratis' : cop(e.precio)}</span>
    </div>`).join('') + `
    <div class="ship-card">
      <strong>Envío nacional GRATIS</strong>
      <span>desde ${cop(CATALOGO.config.envioGratisDesde)}</span>
    </div>`;
}

// ── overlays ──
// bloquea el scroll del fondo mientras hay un modal/drawer abierto
function syncScrollLock() {
  const hayAbierto = Array.from(document.querySelectorAll('.overlay')).some(o => !o.hidden);
  document.body.classList.toggle('sin-scroll', hayAbierto);
}
let focoPrevio = null;
function abrirOverlay(sel) {
  focoPrevio = document.activeElement;
  const ov = document.querySelector(sel);
  ov.hidden = false;
  syncScrollLock();
  // el foco entra al diálogo (no al botón de cerrar) para que el lector de pantalla lo anuncie
  (ov.querySelector('[role=dialog]') || ov.querySelector('input, button'))?.focus();
}
function cerrarOverlay(ov) {
  if (ov.hidden) return;
  ov.hidden = true;
  syncScrollLock();
  focoPrevio?.focus?.();
}

// foco atrapado dentro del diálogo abierto (Tab no se escapa a la página de atrás)
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const ov = Array.from(document.querySelectorAll('.overlay')).find(o => !o.hidden);
  if (!ov) return;
  const focos = [...ov.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null);
  if (!focos.length) return;
  const primero = focos[0], ultimo = focos[focos.length - 1];
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
});

function openCart() { renderCart(); abrirOverlay('#overlay-cart'); }
$('#btn-cart').onclick = openCart;
document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('[data-close]')) cerrarOverlay(ov);
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay').forEach(cerrarOverlay);
});

// ── políticas legales (texto de Shopify) ──
const PRIVACIDAD = `Magillas gestiona esta tienda y protege tus datos personales conforme a la normativa colombiana. Recopilamos nombre, correo, teléfono y dirección solo para procesar pedidos y comunicarnos contigo. No vendemos tus datos. Puedes solicitar acceso o eliminación escribiendo a accessoriesmagillas@gmail.com.`;

const TERMINOS = `Al usar magillasaccesorios.com aceptas estos términos. Los precios están en COP y pueden cambiar sin previo aviso. Las fotos son referenciales. Magillas se reserva el derecho de cancelar pedidos por errores de precio o stock. Para reclamos: accessoriesmagillas@gmail.com o WhatsApp +57 316 5864539.`;

function enlazarPoliticas(pol) {
  const map = {
    'link-pol-envio': ['Política de envío', `<p>${pol.envio || ''}</p><p>Cuando tu pedido sea despachado recibirás el número de guía para rastrearlo en Interrapidísimo.</p>`],
    'link-pol-devol': ['Devoluciones y garantía', `<p>${pol.devoluciones || ''}</p><p>Contacto: <strong>accessoriesmagillas@gmail.com</strong> · WhatsApp <strong>+57 316 5864539</strong></p>`],
    'link-pol-priv': ['Política de privacidad', `<p>${PRIVACIDAD}</p>`],
    'link-pol-term': ['Términos del servicio', `<p>${TERMINOS}</p>`],
  };
  for (const [id, [titulo, html]] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.onclick = e => { e.preventDefault(); abrirInfo(titulo, html); };
  }
}

// ── modal genérico de info ──
function abrirInfo(titulo, html) {
  $('#info-body').innerHTML = `<h3>${titulo}</h3>${html}`;
  abrirOverlay('#overlay-info');
}

// ── rastreo de pedido ──
$('#link-track').onclick = e => {
  e.preventDefault();
  abrirInfo('Rastrear mi pedido', `
    <div class="track-form">
      <input id="tk-id" placeholder="Código del pedido (ej: MG-ABC123)" maxlength="20">
      <input id="tk-tel" placeholder="Celular completo del pedido" maxlength="20" inputmode="tel">
      <button class="btn btn-dark btn-sm" id="tk-buscar">Buscar</button>
      <div id="tk-res" role="status" aria-live="polite"></div>
    </div>`);
  $('#tk-buscar').onclick = async e => {
    const r = await conBoton(e.target, () => fetch(`/api/track?id=${encodeURIComponent($('#tk-id').value)}&tel=${encodeURIComponent($('#tk-tel').value)}`));
    const d = await r.json();
    const ESTADOS = { recibido: '📥 Recibido — pronto te confirmamos por WhatsApp', confirmado: '✅ Confirmado — estamos preparando tu pedido', elaborando: '🎨 En elaboración — tu pieza se está haciendo a mano', enviado: '🚚 Enviado', entregado: '🎉 Entregado' };
    $('#tk-res').innerHTML = r.ok
      ? `<div class="ok-box"><strong>${d.id}</strong><br>${ESTADOS[d.estado] || d.estado}${d.guia ? `<br>Guía ${d.guia}${d.transportadora ? ' · ' + d.transportadora : ''}` : ''}</div>`
      : `<p class="m-lead" style="color:var(--rojo)">${d.error}</p>`;
  };
};

// ── newsletter ──
$('#news-form').onsubmit = async e => {
  e.preventDefault();
  const email = $('#news-email').value.trim();
  const r = await conBoton(e.target.querySelector('button'), () =>
    fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }));
  const d = await r.json();
  $('#news-msg').textContent = r.ok
    ? (d.cupon ? `¡Lista! Usa el cupón ${d.cupon} (−${d.descuento}%) en tu primera compra 💛` : '¡Lista! Te avisaremos de lo nuevo 💛')
    : d.error;
};

// ── menú móvil ──
$('#btn-menu').onclick = () => {
  const nav = $('#nav-cats');
  const abierto = nav.classList.toggle('open');
  $('#btn-menu').setAttribute('aria-expanded', abierto);
};

// ── chat IA ──
const chatMsgs = JSON.parse(sessionStorage.getItem('magillas_chat') || '[]');
const QUICK = ['¿De qué materiales son?', '¿Cuánto tarda mi pedido?', '¿Cómo personalizo con foto?', 'Cambios y garantía'];
function renderQuick() {
  if ($('#chat-quick')) return;
  const div = document.createElement('div');
  div.id = 'chat-quick';
  div.className = 'chat-quick';
  div.innerHTML = QUICK.map(q => `<button type="button" class="quick-chip">${q}</button>`).join('');
  $('#chat-msgs').appendChild(div);
  div.onclick = e => {
    if (e.target.classList.contains('quick-chip')) { $('#chat-input').value = e.target.textContent; $('#chat-form').dispatchEvent(new Event('submit')); div.remove(); }
  };
}
// restaurar conversación previa de la sesión
if (chatMsgs.length) {
  chatMsgs.forEach(m => addMsg(m.content, m.role === 'user' ? 'user' : 'bot'));
}
function sugerirProductos(reply) {
  if (!CATALOGO?.productos) return;
  const menciones = productosMencionadosEnTexto(reply);
  if (!menciones.length) return;
  const div = document.createElement('div');
  div.className = 'chat-sugerencias';
  div.innerHTML = menciones.slice(0, 3).map(p =>
    `<div class="chat-prod-wrap"><button type="button" class="chat-prod" data-open="${p.id}"><img src="${p.img}" alt=""><span>${p.nombre}<br><strong>${cop(p.precio)}</strong></span></button>
    <button type="button" class="btn btn-gold btn-sm chat-add" data-chat-add="${p.id}">Añadir al carrito</button></div>`).join('');
  $('#chat-msgs').appendChild(div);
  $('#chat-msgs').scrollTop = 1e9;
}

function normTxt(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function productosMencionadosEnTexto(text) {
  const t = normTxt(text);
  const porId = [...text.matchAll(/id:\s*([a-z0-9-]+)/gi)].map(m => m[1]);
  const scored = CATALOGO.productos.map(p => {
    let score = 0;
    if (porId.includes(p.id)) score += 200;
    const nombre = normTxt(p.nombre);
    if (t.includes(nombre)) score += 120;
    nombre.split(/\s+/).filter(w => w.length > 3).forEach(w => { if (t.includes(w)) score += 18; });
    const idSp = p.id.replace(/-/g, ' ');
    if (t.includes(idSp)) score += 90;
    // sinónimos frecuentes en chat
    const alias = {
      'collar-carta': ['collar carta', 'carta', 'sobre', 'mensaje secreto'],
      'collar-militar': ['militar', 'placa militar', 'policia'],
      'pulsera-esclava': ['esclava', 'pulsera grabada'],
      'relicarios-individuales': ['relicario', 'foto', 'con foto'],
      'collar-corazon-cupido': ['corazon', 'cupido', 'san valentin'],
      'decorative-gift-bag-for-special-occasions': ['bolsa de regalo', 'bolsita'],
    };
    (alias[p.id] || []).forEach(a => { if (t.includes(normTxt(a))) score += 40; });
    if (p.destacado && score > 0) score += 5;
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const seen = new Set();
  return scored.map(x => x.p).filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
}
$('#chat-fab').onclick = () => { $('#chat-panel').hidden = !$('#chat-panel').hidden; renderQuick(); $('#chat-input').focus(); };
$('#chat-close').onclick = () => { $('#chat-panel').hidden = true; };
$('#link-chat-nota').onclick = e => { e.preventDefault(); $('#chat-panel').hidden = false; $('#chat-input').focus(); };

$('#chat-form').onsubmit = async e => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  $('#chat-quick')?.remove();
  chatMsgs.push({ role: 'user', content: text });
  addMsg(text, 'user');
  const typing = addMsg('Magui está escribiendo...', 'bot msg-typing');
  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: chatMsgs }) });
    if (!r.ok) {
      typing.remove();
      const data = await r.json().catch(() => ({}));
      addMsg(data.error || 'Ups, inténtalo de nuevo 🙈', 'bot');
      return;
    }
    // streaming: los tokens van llegando en vivo
    const lector = r.body.getReader();
    const dec = new TextDecoder();
    let reply = '';
    let burbuja = null;
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      reply += dec.decode(value, { stream: true });
      if (!burbuja) { typing.remove(); burbuja = addMsg('', 'bot'); }
      burbuja.textContent = reply;
      $('#chat-msgs').scrollTop = 1e9;
    }
    if (!reply) { typing.remove(); addMsg('Lo siento, ¿me lo repites? 🙈', 'bot'); return; }
    chatMsgs.push({ role: 'assistant', content: reply });
    sessionStorage.setItem('magillas_chat', JSON.stringify(chatMsgs.slice(-20)));
    sugerirProductos(reply);
  } catch {
    typing.remove();
    addMsg('No pude conectarme 😔 Escríbenos por WhatsApp o Instagram @magillas_accesorios', 'bot');
  }
};
function addMsg(text, cls) {
  const div = document.createElement('div');
  div.className = 'msg msg-' + cls;
  div.textContent = text;
  $('#chat-msgs').appendChild(div);
  $('#chat-msgs').scrollTop = 1e9;
  return div;
}


function upsellHtml() {
  const ups = CATALOGO?.config?.upsells || [];
  if (!ups.length || !cart.length) return '';
  const ids = new Set(cart.map(i => i.id));
  const btns = ups.filter(u => !ids.has(u.id)).map(u => {
    const p = CATALOGO.productos.find(x => x.id === u.id);
    if (!p) return '';
    return `<button type="button" class="upsell-chip" data-upsell-add="${p.id}">+ ${escapa(u.label || p.nombre)} · ${cop(p.precio)}</button>`;
  }).filter(Boolean).join('');
  return btns ? `<div class="cart-upsell"><p class="free-ship-hint">Completa tu regalo:</p><div class="upsell-row">${btns}</div></div>` : '';
}

function renderQuiz() {
  const root = document.getElementById('quiz-root');
  const qz = CATALOGO?.config?.quizRegalo || CATALOGO?.quizRegalo;
  if (!root || !qz?.preguntas?.length) return;
  const resp = {};
  let step = 0;
  const render = () => {
    if (step >= qz.preguntas.length) return showResult();
    const pr = qz.preguntas[step];
    root.innerHTML = `
      <p class="quiz-step">Pregunta ${step + 1} de ${qz.preguntas.length}</p>
      <h3 class="quiz-q">${escapa(pr.texto)}</h3>
      <div class="quiz-opts">${pr.opciones.map(o =>
        `<button type="button" class="quiz-opt" data-v="${o.v}">${escapa(o.l)}</button>`).join('')}</div>`;
    root.querySelectorAll('.quiz-opt').forEach(btn => btn.onclick = () => {
      resp[pr.id] = btn.dataset.v;
      step++;
      render();
    });
  };
  const showResult = () => {
    const key = [resp.para, resp.presupuesto, resp.tipo].filter(Boolean).join('|');
    let ids = qz.mapa[key];
    if (!ids) {
      ids = Object.values(qz.mapa).flat();
      ids = [...new Set(ids)].slice(0, 3);
    }
    const prods = ids.map(id => CATALOGO.productos.find(p => p.id === id)).filter(Boolean);
    root.innerHTML = `
      <h3 class="quiz-q">Te recomendamos:</h3>
      <div class="quiz-results">${prods.map(p =>
        `<button type="button" class="quiz-res" data-open="${p.id}"><img src="${p.img}" alt=""><span>${p.nombre}<br><strong>${cop(p.precio)}</strong></span></button>`).join('')}</div>
      <button type="button" class="btn btn-line btn-sm" id="quiz-retry">Empezar de nuevo</button>`;
    document.getElementById('quiz-retry')?.addEventListener('click', () => { step = 0; Object.keys(resp).forEach(k => delete resp[k]); render(); });
    trackEvent('quiz_complete', { key });
  };
  render();
}
