// Emails transaccionales vía Resend (sin dependencias)
async function enviarEmail({ apiKey, from, to, subject, html }) {
  if (!apiKey || !to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, skip: true };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: from || 'Magillas <pedidos@magillas.co>', to: [to], subject, html }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Resend ${r.status}: ${t.slice(0, 200)}`);
  }
  return { ok: true };
}

function tplPedidoRecibido(pedido, siteUrl) {
  const items = (pedido.items || []).map(i =>
    `<li>${i.qty}× ${i.nombre} — $${(i.precio * i.qty).toLocaleString('es-CO')}</li>`).join('');
  return `<div style="font-family:sans-serif;max-width:520px">
    <h2>¡Recibimos tu pedido, ${pedido.nombre}!</h2>
    <p>Código: <strong>${pedido.id}</strong></p>
    <ul>${items}</ul>
    <p><strong>Total:</strong> $${Number(pedido.total).toLocaleString('es-CO')} COP</p>
    <p>Te escribiremos por WhatsApp para confirmar personalización y pago.</p>
    <p><a href="${siteUrl}/#faq">Rastrear pedido</a></p>
  </div>`;
}

function tplPedidoEnviado(pedido, siteUrl) {
  const guia = pedido.guia ? `<p>Guía: <strong>${pedido.guia}</strong>${pedido.transportadora ? ` (${pedido.transportadora})` : ''}</p>` : '';
  return `<div style="font-family:sans-serif;max-width:520px">
    <h2>Tu pedido ${pedido.id} va en camino</h2>
    ${guia}
    <p>¡Gracias por confiar en Magillas!</p>
    <p><a href="${siteUrl}/#resenas">Cuéntanos cómo te fue</a></p>
  </div>`;
}

function tplResena(pedido, siteUrl) {
  return `<div style="font-family:sans-serif;max-width:520px">
    <h2>¿Cómo te fue con tu pedido ${pedido.id}?</h2>
    <p>Nos encantaría leer tu experiencia. Solo toma 1 minuto.</p>
    <p><a href="${siteUrl}/#productos">Dejar una reseña en la tienda</a></p>
  </div>`;
}

async function emailPedidoRecibido(ENV, pedido) {
  if (!pedido.email) return;
  await enviarEmail({
    apiKey: ENV.RESEND_API_KEY,
    from: ENV.RESEND_FROM,
    to: pedido.email,
    subject: `Pedido ${pedido.id} recibido — MAGILLAS`,
    html: tplPedidoRecibido(pedido, ENV.SITE_URL || 'https://magillasaccesorios.com'),
  });
}

async function emailPedidoEnviado(ENV, pedido) {
  if (!pedido.email) return;
  await enviarEmail({
    apiKey: ENV.RESEND_API_KEY,
    from: ENV.RESEND_FROM,
    to: pedido.email,
    subject: `Tu pedido ${pedido.id} fue enviado — MAGILLAS`,
    html: tplPedidoEnviado(pedido, ENV.SITE_URL || 'https://magillasaccesorios.com'),
  });
}

async function emailPedirResena(ENV, pedido) {
  if (!pedido.email) return;
  await enviarEmail({
    apiKey: ENV.RESEND_API_KEY,
    from: ENV.RESEND_FROM,
    to: pedido.email,
    subject: `¿Cómo te fue con Magillas? — ${pedido.id}`,
    html: tplResena(pedido, ENV.SITE_URL || 'https://magillasaccesorios.com'),
  });
}

module.exports = { emailPedidoRecibido, emailPedidoEnviado, emailPedirResena };
