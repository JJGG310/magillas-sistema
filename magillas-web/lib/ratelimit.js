// Rate limit distribuido (Supabase) con fallback en memoria para local.
function crearRateLimit({ SB_URL, SB_ANON, json }) {
  const golpes = new Map();

  async function limitar(req, res, clave, max, ventanaMs) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'ip';
    const bucket = `magillas:${clave}:${ip}`;

    if (SB_URL && SB_ANON) {
      try {
        const r = await fetch(`${SB_URL}/rest/v1/rpc/check_rate_limit`, {
          method: 'POST',
          headers: {
            apikey: SB_ANON,
            Authorization: `Bearer ${SB_ANON}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_bucket: bucket,
            p_limit: max,
            p_window_seconds: Math.max(1, Math.ceil(ventanaMs / 1000)),
          }),
        });
        if (r.ok) {
          const allowed = await r.json();
          if (allowed === false) {
            json(res, 429, { error: 'Vas muy rápido 🙈 Espera un momento e inténtalo de nuevo.' });
            return true;
          }
          return false;
        }
      } catch (e) {
        console.error('[RATE]', e.message);
      }
    }

    const k = clave + '|' + ip;
    const ahora = Date.now();
    const recientes = (golpes.get(k) || []).filter(t => ahora - t < ventanaMs);
    if (recientes.length >= max) {
      json(res, 429, { error: 'Vas muy rápido 🙈 Espera un momento e inténtalo de nuevo.' });
      return true;
    }
    recientes.push(ahora);
    golpes.set(k, recientes);
    if (golpes.size > 5000) golpes.clear();
    return false;
  }

  return { limitar };
}

module.exports = { crearRateLimit };
