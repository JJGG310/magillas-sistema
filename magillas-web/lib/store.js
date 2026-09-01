// Capa de persistencia: Supabase (producción) o JSON local (desarrollo).
const fs = require('fs');
const path = require('path');

function crearStore({ DATA, DATA_BUNDLE, ORDERS, REVIEWS, NEWS, leerJson, escribirJson, corruptos }) {
  const ENV = {};
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'ADMIN_TOKEN']) {
    if (process.env[k]) ENV[k] = process.env[k];
  }
  if (!ENV.SUPABASE_URL) {
    try {
      for (const line of fs.readFileSync(path.join(DATA_BUNDLE, '..', '.env'), 'utf8').split('\n')) {
        const m = line.match(/^(SUPABASE_[A-Z_]+|ADMIN_TOKEN)=(.*)$/);
        if (m && !ENV[m[1]]) ENV[m[1]] = m[2].trim();
      }
    } catch { /* local sin .env */ }
  }

  const SB_URL = ENV.SUPABASE_URL;
  const SB_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
  const SB_ANON = ENV.SUPABASE_ANON_KEY;
  const STORE_SECRET = ENV.ADMIN_TOKEN;
  const usaServiceRole = !!(SB_URL && SB_KEY);
  const usaRpc = !!(SB_URL && SB_ANON && STORE_SECRET && !SB_KEY);
  const usaSupabase = usaServiceRole || usaRpc;

  async function sb(pathAndQuery, { method = 'GET', body, prefer, key = SB_KEY } = {}) {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    if (prefer) headers.Prefer = prefer;
    const r = await fetch(`${SB_URL}/rest/v1/${pathAndQuery}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Supabase ${method} ${pathAndQuery}: ${r.status} ${t.slice(0, 200)}`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  async function rpc(fn, args) {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: `Bearer ${SB_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_secret: STORE_SECRET, ...args }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Supabase RPC ${fn}: ${r.status} ${t.slice(0, 200)}`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  async function pedidosTodos() {
    if (!usaSupabase) return leerJson(ORDERS, []);
    if (usaRpc) return rpc('magillas_pedidos_todos', {});
    const rows = await sb('magillas_orders?select=data&order=created_at.desc');
    return rows.map(r => r.data);
  }

  async function pedidoPorId(id) {
    if (!usaSupabase) {
      const todos = leerJson(ORDERS, []);
      return todos.find(o => o.id === id) || null;
    }
    if (usaRpc) return rpc('magillas_pedido_por_id', { p_id: id });
    const rows = await sb(`magillas_orders?id=eq.${encodeURIComponent(id)}&select=data`);
    return rows?.[0]?.data || null;
  }

  async function guardarPedido(pedido) {
    if (!usaSupabase) {
      const pedidos = leerJson(ORDERS, []);
      pedidos.push(pedido);
      escribirJson(ORDERS, pedidos);
      return;
    }
    if (usaRpc) {
      await rpc('magillas_guardar_pedido', { p_id: pedido.id, p_data: pedido });
      return;
    }
    await sb('magillas_orders', {
      method: 'POST',
      body: { id: pedido.id, data: pedido },
      prefer: 'return=minimal',
    });
  }

  async function actualizarPedido(id, parches) {
    if (!usaSupabase) {
      const pedidos = leerJson(ORDERS, []);
      const p = pedidos.find(o => o.id === id);
      if (!p) return false;
      Object.assign(p, parches);
      escribirJson(ORDERS, pedidos);
      return true;
    }
    const actual = await pedidoPorId(id);
    if (!actual) return false;
    const data = { ...actual, ...parches };
    if (usaRpc) return rpc('magillas_actualizar_pedido', { p_id: id, p_data: data });
    await sb(`magillas_orders?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { data },
      prefer: 'return=minimal',
    });
    return true;
  }

  async function resenasPublicas() {
    if (!usaSupabase) return leerJson(REVIEWS, []).filter(r => r.aprobada !== false);
    const q = 'magillas_reviews?aprobada=eq.true&select=producto,nombre,estrellas,comentario,fecha&order=fecha.desc';
    const rows = usaRpc
      ? await sb(q, { key: SB_ANON })
      : await sb(q);
    return rows.map(mapResena);
  }

  async function resenasTodas() {
    if (!usaSupabase) return leerJson(REVIEWS, []);
    if (usaRpc) {
      const rows = await rpc('magillas_resenas_todas', {});
      return (rows || []).map(mapResena);
    }
    const rows = await sb('magillas_reviews?select=producto,nombre,estrellas,comentario,fecha,aprobada&order=fecha.desc');
    return rows.map(mapResena);
  }

  function mapResena(r) {
    return {
      producto: r.producto,
      nombre: r.nombre,
      estrellas: r.estrellas,
      comentario: r.comentario || '',
      fecha: r.fecha,
      aprobada: r.aprobada !== false,
    };
  }

  async function guardarResena(r) {
    if (!usaSupabase) {
      const reviews = leerJson(REVIEWS, []);
      reviews.push({ ...r, aprobada: false });
      escribirJson(REVIEWS, reviews);
      return;
    }
    if (usaRpc) {
      await rpc('magillas_guardar_resena', {
        p_producto: r.producto,
        p_nombre: r.nombre,
        p_estrellas: r.estrellas,
        p_comentario: r.comentario || null,
        p_fecha: r.fecha,
      });
      return;
    }
    await sb('magillas_reviews', {
      method: 'POST',
      body: {
        producto: r.producto,
        nombre: r.nombre,
        estrellas: r.estrellas,
        comentario: r.comentario || null,
        fecha: r.fecha,
      },
      prefer: 'return=minimal',
    });
  }

  async function borrarResena(fecha, producto) {
    if (!usaSupabase) {
      const reviews = leerJson(REVIEWS, []).filter(r => !(r.fecha === fecha && r.producto === producto));
      escribirJson(REVIEWS, reviews);
      return;
    }
    if (usaRpc) {
      await rpc('magillas_borrar_resena', { p_fecha: fecha, p_producto: producto });
      return;
    }
    await sb(
      `magillas_reviews?fecha=eq.${encodeURIComponent(fecha)}&producto=eq.${encodeURIComponent(producto)}`,
      { method: 'DELETE', prefer: 'return=minimal' }
    );
  }

  async function aprobarResena(fecha, producto, aprobada) {
    if (!usaSupabase) {
      const reviews = leerJson(REVIEWS, []);
      const r = reviews.find(x => x.fecha === fecha && x.producto === producto);
      if (!r) return false;
      r.aprobada = !!aprobada;
      escribirJson(REVIEWS, reviews);
      return true;
    }
    if (usaRpc) {
      await rpc('magillas_aprobar_resena', { p_fecha: fecha, p_producto: producto, p_aprobada: !!aprobada });
      return true;
    }
    await sb(
      `magillas_reviews?fecha=eq.${encodeURIComponent(fecha)}&producto=eq.${encodeURIComponent(producto)}`,
      { method: 'PATCH', body: { aprobada: !!aprobada }, prefer: 'return=minimal' }
    );
    return true;
  }

  async function newsletterTodos() {
    if (!usaSupabase) return leerJson(NEWS, []);
    if (usaRpc) return rpc('magillas_newsletter_todos', {});
    const rows = await sb('magillas_newsletter?select=email,fecha&order=fecha.desc');
    return rows;
  }

  async function guardarNewsletter(email, fecha) {
    if (!usaSupabase) {
      const lista = leerJson(NEWS, []);
      if (!lista.find(s => s.email === email)) {
        lista.push({ email, fecha });
        escribirJson(NEWS, lista);
      }
      return;
    }
    if (usaRpc) {
      await rpc('magillas_guardar_newsletter', { p_email: email, p_fecha: fecha });
      return;
    }
    await sb('magillas_newsletter', {
      method: 'POST',
      body: { email, fecha },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });
  }

  return {
    usaSupabase,
    pedidosTodos,
    pedidoPorId,
    guardarPedido,
    actualizarPedido,
    resenasPublicas,
    resenasTodas,
    guardarResena,
    borrarResena,
    aprobarResena,
    newsletterTodos,
    guardarNewsletter,
  };
}

module.exports = { crearStore };
