// Vercel serverless function. Drafts a formal notification to the Concello da
// Coruna from one audited record. The API key lives here, server side, and is
// never shipped to the browser.
//
// Model is claude-haiku-4-5: the task is a short, formulaic letter from
// structured fields, which is what Haiku is for, and it costs about a quarter
// of a cent per letter against roughly five times that on an Opus tier model.
// Haiku 4.5 does not accept output_config.effort, so it is not set.
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 1024

const CATEGORY_ES = {
  circular_item: 'objeto en buen estado depositado para reutilizacion',
  illegal_dumping: 'vertido ilegal de residuos',
  bulk_waste: 'residuo voluminoso abandonado en via publica',
  urban_damage: 'dano o incidencia en via publica',
  container_issue: 'incidencia en contenedor',
  other: 'incidencia de limpieza viaria',
}

const SYSTEM = `Redactas comunicaciones formales dirigidas al Concello da Coruna, en espanol de Espana.

Reglas:
- Tono institucional, sobrio y breve. Entre 90 y 160 palabras.
- Estructura: encabezamiento, exposicion del hecho con su ubicacion y fecha, y peticion concreta de actuacion.
- Cita solo los datos que se te entregan. No inventes calles, numeros, fechas, nombres de tecnicos ni expedientes.
- No atribuyas responsabilidad a ninguna persona ni empresa concreta.
- Si un dato falta, omitelo en silencio, no escribas marcadores de posicion ni corchetes.
- Devuelve unicamente el texto de la comunicacion, sin comentarios ni titulos de seccion.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error:
        'ANTHROPIC_API_KEY is not configured on this deployment, so the letter cannot be drafted.',
    })
  }

  const { categoria, severidad, localizacion, zona, fecha, descripcion } = req.body || {}

  if (!localizacion && !zona) {
    return res
      .status(400)
      .json({ error: 'A record needs at least a localizacion or a zona to be reported.' })
  }

  // Only the fields that actually carry a value reach the model. An absent
  // field is left out entirely rather than sent as an empty string, so the
  // model has nothing to pad.
  const hecho = [
    ['Tipo de incidencia', CATEGORY_ES[categoria] || categoria],
    ['Ubicacion', localizacion],
    ['Barrio', zona],
    ['Fecha de constatacion', fecha],
    ['Severidad valorada (1 a 3)', severidad],
    ['Descripcion registrada en origen', descripcion],
  ]
    .filter(([, value]) => value != null && value !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Redacta la comunicacion al Concello da Coruna a partir de estos datos:\n\n${hecho}`,
        },
      ],
    })

    // content is a discriminated union, narrow before reading .text.
    const carta = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    if (!carta) {
      return res.status(502).json({ error: 'The model returned no text.' })
    }

    return res.status(200).json({
      carta,
      model: MODEL,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
  } catch (err) {
    // Typed SDK errors carry a status; anything else is a genuine 500.
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500
    console.error('[carta] request failed', status, err?.message)
    return res.status(status).json({ error: err?.message || 'Request to Claude failed.' })
  }
}
