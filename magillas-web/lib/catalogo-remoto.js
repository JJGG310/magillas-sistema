// Lee el catálogo editable desde Supabase (tabla magillas_products + magillas_content).
// Si Supabase falla o no está configurado, quien llama usa el products.json del proyecto:
// la tienda nunca se queda sin catálogo.
const TTL_MS = 60_000; // el panel tarda como mucho un minuto en reflejarse en la tienda

function crearCatalogoRemoto({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
  const activo = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  let cache = null;
  let cacheAt = 0;
  let enVuelo = null;

  async function pedir(tabla, query) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`${tabla}: ${r.status} ${(await r.text()).slice(0, 120)}`);
    return r.json();
  }

  // Devuelve el producto con la misma forma que usa products.json (para no tocar el resto del sitio).
  function aFormatoSitio(p) {
    const out = {
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      precio: p.precio,
      desc: p.descripcion || '',
      img: p.img,
      imgs: Array.isArray(p.imgs) ? p.imgs : [],
      stock: p.stock,
    };
    if (p.precio_antes) out.precioAntes = p.precio_antes;
    if (p.destacado) out.destacado = true;
    if (p.badge) out.badge = p.badge;
    if (p.custom) out.custom = p.custom;
    if (p.preview) out.preview = p.preview;
    if (p.foto_requerida) out.fotoRequerida = true;
    return out;
  }

  async function traer() {
    const [filas, bloques] = await Promise.all([
      pedir('magillas_products', 'select=*&activo=is.true&order=orden.asc,nombre.asc'),
      pedir('magillas_content', 'select=clave,valor'),
    ]);
    if (!filas.length) throw new Error('catálogo vacío en Supabase');

    const contenido = {};
    for (const b of bloques) contenido[b.clave] = b.valor;
    const { categorias, ...config } = contenido;

    return {
      config,
      categorias: categorias || [],
      productos: filas.map(aFormatoSitio),
    };
  }

  // Devuelve el catálogo cacheado, o null si no se pudo (quien llama hace el respaldo).
  async function obtener() {
    if (!activo) return null;
    if (cache && Date.now() - cacheAt < TTL_MS) return cache;
    if (enVuelo) return enVuelo;                 // varias peticiones a la vez → una sola consulta
    enVuelo = traer()
      .then(c => { cache = c; cacheAt = Date.now(); return c; })
      .catch(e => {
        console.error('[CATÁLOGO REMOTO]', e.message);
        return cache;                            // si ya había uno bueno, se sigue usando
      })
      .finally(() => { enVuelo = null; });
    return enVuelo;
  }

  function invalidar() { cacheAt = 0; }

  return { activo, obtener, invalidar };
}

module.exports = { crearCatalogoRemoto };
