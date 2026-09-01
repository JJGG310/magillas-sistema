// Sube fotos de personalización a Supabase Storage (evita base64 enorme en pedidos).
async function subirFotoPedido({ SB_URL, SB_ANON }, orderId, itemIdx, dataUrl) {
  if (!SB_URL || !SB_ANON || !dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const mime = m[1];
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 100 || buf.length > 102400) return null;
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `pedidos/${orderId}/${itemIdx}.${ext}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/magillas-fotos/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: SB_ANON,
      Authorization: `Bearer ${SB_ANON}`,
      'Content-Type': mime,
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Storage upload: ${r.status} ${t.slice(0, 120)}`);
  }
  return `${SB_URL}/storage/v1/object/public/magillas-fotos/${objectPath}`;
}

module.exports = { subirFotoPedido };
