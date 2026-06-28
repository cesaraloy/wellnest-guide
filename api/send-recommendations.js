const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (hits.get(ip) || []).filter(t => t > windowStart);
  timestamps.push(now);
  hits.set(ip, timestamps);
  if (hits.size > 5000) hits.clear();
  return timestamps.length > RATE_LIMIT_MAX;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes, inténtalo de nuevo en un minuto' });
  }

  try {
    const { lead, insight, retreats } = req.body || {};

    if (!lead || !lead.email || typeof lead.email !== 'string' || !EMAIL_RE.test(lead.email) || lead.email.length > 254) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (!Array.isArray(retreats) || retreats.length === 0 || retreats.length > 10) {
      return res.status(400).json({ error: 'Missing lead or retreats data' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    // Remitente: debe pertenecer a un dominio verificado en Resend
    // (p.ej. recomendaciones@wellnest.guide). Mientras el dominio no esté
    // verificado, Resend solo permite enviar a la propia cuenta del usuario
    // desde onboarding@resend.dev — útil para probar antes de verificar.
    const FROM = process.env.RESEND_FROM || 'Wellnest Guide <onboarding@resend.dev>';

    const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    const cardsHtml = retreats.map(r => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #eee;">
          ${r.photo ? `<a href="${r.bookUrl}"><img src="${escape(r.photo)}" alt="${escape(r.name)}" width="100%" style="display:block;width:100%;max-height:220px;object-fit:cover;border-radius:4px;margin:0 0 12px;"></a>` : ''}
          <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:18px;color:#2c2c2c;">${escape(r.name)}</p>
          <p style="margin:0 0 6px;font-size:12px;color:#999;letter-spacing:.04em;">📍 ${escape(r.location)} · ${escape(r.duracion)}</p>
          <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#666;">${escape(r.desc)}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#7a8c6e;font-weight:bold;">desde ${escape(r.precio_desde)}€ · ${escape(r.match || 88)}% de encaje</p>
          <table cellpadding="0" cellspacing="0"><tr><td align="right">
            <a href="${r.bookUrl}" style="display:inline-block;background:#2c2c2c;color:#ffffff;text-decoration:none;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:10px 20px;border-radius:2px;">Ver disponibilidad →</a>
          </td></tr></table>
        </td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family:Helvetica,Arial,sans-serif;background:#faf8f4;padding:32px 16px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:4px;overflow:hidden;">
          <div style="background:#2c2c2c;padding:24px 32px;text-align:center;">
            <img src="https://wellnest.guide/assets/wellnest-inline_light.png" alt="Wellnest Guide" height="24" style="display:inline-block;height:24px;">
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 4px;font-size:13px;color:#999;letter-spacing:.1em;text-transform:uppercase;">Hola ${escape(lead.name)},</p>
            <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:normal;font-size:24px;color:#2c2c2c;">Aquí tienes tus recomendaciones</h1>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#666;">${escape(insight || 'Hemos seleccionado estos retiros pensando en lo que buscas. Guarda este correo para volver a ellos cuando quieras reservar.')}</p>
            <table width="100%" cellpadding="0" cellspacing="0">${cardsHtml}</table>
            <p style="margin:28px 0 0;font-size:11px;line-height:1.6;color:#aaa;">Wellnest Guide puede recibir una comisión si reservas a través de estos enlaces, sin coste adicional para ti. Consulta nuestros <a href="https://wellnest.guide/legal#terminos" style="color:#7a8c6e;">términos legales</a> y <a href="https://wellnest.guide/legal#privacidad" style="color:#7a8c6e;">política de privacidad</a>.</p>
          </div>
        </div>
      </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: FROM,
        to: [lead.email],
        subject: 'Tus recomendaciones de retiros — Wellnest Guide',
        html
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('Resend API error', response.status, responseText);
      return res.status(502).json({ error: 'No se pudo enviar el correo' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-recommendations handler error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
