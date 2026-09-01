// Wompi — links de pago (PSE, tarjeta, Nequi, Daviplata)
const WOMPI_API = 'https://production.wompi.co/v1';

async function crearLinkPago({ privateKey, pedidoId, total, nombre, redirectUrl }) {
  if (!privateKey) throw new Error('Wompi no configurado');
  const amountInCents = Math.round(Number(total) * 100);
  if (amountInCents < 100000) throw new Error('Monto mínimo Wompi');

  const r = await fetch(`${WOMPI_API}/payment_links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${privateKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Pedido ${pedidoId}`,
      description: `MAGILLAS ${pedidoId}`,
      single_use: true,
      collect_shipping: false,
      currency: 'COP',
      amount_in_cents: amountInCents,
      redirect_url: redirectUrl,
      sku: pedidoId,
      customer_data: {
        full_name: String(nombre || 'Cliente').slice(0, 80),
        email: 'pedidos@magillas.co',
      },
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data?.error?.reason || data?.error?.message || `Wompi ${r.status}`);
  }
  const link = data?.data?.permalink || data?.data?.id;
  if (!link) throw new Error('Wompi sin link');
  const url = String(link).startsWith('http') ? link : `https://checkout.wompi.co/l/${link}`;
  return { url, id: data?.data?.id };
}

function verificarFirmaWebhook(rawBody, signature, eventsSecret) {
  if (!eventsSecret || !signature) return false;
  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', eventsSecret).update(rawBody).digest('hex');
  const sig = String(signature).trim();
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch {
    return false;
  }
}

module.exports = { crearLinkPago, verificarFirmaWebhook };
