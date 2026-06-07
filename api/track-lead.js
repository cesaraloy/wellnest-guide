module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, lead, search, retreat } = req.body || {};

    if (!type || !lead || !lead.email) {
      return res.status(400).json({ error: 'Missing lead data' });
    }

    // De momento registramos el evento en los logs de Vercel (Project → Logs).
    // Cuando se conecte una base de datos o un proveedor de email (ej. Resend,
    // Supabase, Airtable…), este es el punto donde persistir/enviar el registro
    // para el recordatorio por correo con las recomendaciones y enlaces de reserva.
    console.log(JSON.stringify({
      event: 'wellnest_lead_event',
      type,                // 'search' | 'click'
      lead,                // { name, email }
      search: search || null,   // selecciones del formulario de búsqueda
      retreat: retreat || null, // detalle del listing en el que ha hecho clic
      ts: new Date().toISOString()
    }));

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
