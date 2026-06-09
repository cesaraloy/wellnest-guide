const fs = require('fs');
const path = require('path');

let _catalog = null;
function getCatalog() {
  if (!_catalog) {
    const p = path.join(__dirname, '..', 'data', 'retreats.json');
    _catalog = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return _catalog;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({ error: 'Missing preferences' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const catalog = getCatalog();

    const catalogSummary = catalog.map(r =>
      `- id:"${r.id}" | ${r.name} | ${r.location} | tags:[${r.tags.join(',')}] | precio_desde:${r.precio_desde}€ | precio_tag:${r.precio_tag}`
    ).join('\n');

    const prompt = `Eres un experto en retiros de bienestar en España. El usuario busca:
- Tipos de experiencia: ${preferences.tipos}
- Región: ${preferences.region}
- Duración: ${preferences.duracion}
- Personas: ${preferences.personas || 2}${preferences.fechaInicio ? `\n- Fechas aproximadas: del ${preferences.fechaInicio}${preferences.fechaFin ? ' al ' + preferences.fechaFin : ''}` : ''}
- Presupuesto máximo: ${preferences.presupuesto >= 3000 ? 'sin límite' : preferences.presupuesto + '€'} (total para ${preferences.personas || 2} personas)
- Ambiente: ${preferences.exclusividad}

Aquí está el catálogo completo de retiros disponibles:
${catalogSummary}

Selecciona los retiros que MEJOR encajan con las preferencias del usuario. Puedes seleccionar entre 1 y ${Math.min(catalog.length, 4)} retiros. Si ninguno encaja bien con la región exacta, elige los que mejor encajen en el resto de criterios.

Para cada retiro seleccionado, escribe una descripción personalizada (2-3 frases) explicando por qué encaja con este perfil concreto, y asigna un porcentaje de encaje (70-99).

Responde SOLO en JSON válido sin texto adicional ni backticks:
{
  "insight": "2-3 frases personalizadas y cálidas explicando por qué estas opciones encajan con el perfil.",
  "selected": [
    {
      "id": "id-del-retiro-del-catalogo",
      "desc": "Descripción personalizada de 2-3 frases explicando el encaje con este perfil concreto.",
      "match": 92
    }
  ]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        error: 'Anthropic API error',
        status: response.status,
        detail: responseText
      });
    }

    const data = JSON.parse(responseText);
    const text = data.content.map(b => b.text || '').join('');
    const aiResult = JSON.parse(text.replace(/```json|```/g, '').trim());

    // enrich AI-selected IDs with full catalog data
    const catalogMap = Object.fromEntries(catalog.map(r => [r.id, r]));
    const retreats = (aiResult.selected || [])
      .map(sel => {
        const base = catalogMap[sel.id];
        if (!base) return null;
        return {
          id: base.id,
          name: base.name,
          location: base.location,
          region: base.region,
          emoji: base.tags[0] === 'surf' ? '🏄' : base.tags.includes('yoga') ? '🧘' : base.tags.includes('spa') ? '💆' : '🌿',
          tipo: base.tags.slice(0, 3),
          desc: sel.desc,
          duracion: base.duracion,
          precio_desde: base.precio_desde,
          precio_tag: base.precio_tag,
          plataforma: 'booking',
          booking_url: base.booking_url,
          photo: base.photo,
          match: sel.match
        };
      })
      .filter(Boolean);

    return res.status(200).json({ result: JSON.stringify({ insight: aiResult.insight, retreats }) });

  } catch (err) {
    return res.status(500).json({
      error: err.message,
      type: err.constructor.name
    });
  }
};
