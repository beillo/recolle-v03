// Vercel serverless function. Drafts a formal communication to the Concello da
// Coruna. The API key lives here, server side, and is never shipped to the
// browser.
//
// The pipeline is carried over from v0.2's api/carta.js, including the detail
// that matters most: the date is computed here, in Europe/Madrid, and the model
// is told to copy it literally. A model asked to date a letter itself will
// invent one, and a wrong date on a communication to a public body is the kind
// of error that discredits the whole thing.
//
// Two origins, because the letter is not the same document in both cases:
//   record     a row already in the audited dataset, signed as an
//              independent monitoring project
//   submission something a citizen just reported, signed as a resident,
//              which is how v0.2 signed it
//
// Model is claude-haiku-4-5. v0.2 used claude-sonnet-4-6. The task is a short
// formulaic letter assembled from structured fields, so Haiku covers it at
// about a quarter of a cent per draft. Haiku 4.5 does not accept
// output_config.effort, so it is not set.
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 1024

const CATEGORY_ES = {
  container_issue: 'contenedor lleno o en mal estado',
  illegal_dumping: 'vertido ilegal de residuos',
  bulk_waste: 'residuo voluminoso abandonado en via publica',
  urban_damage: 'dano o desperfecto en via publica',
  circular_item: 'objeto en buen estado depositado para reutilizacion',
  other: 'incidencia de limpieza viaria',
}

const SIGN_OFF = {
  record: 'Atentamente, Recolle, proyecto independiente de seguimiento de residuos urbanos',
  submission: 'Atentamente, Un ciudadano de A Coruna',
}

const PROVENANCE = {
  record:
    'El hecho procede de un registro documentado y verificado por el proyecto, con fecha de constatacion propia.',
  submission:
    'El hecho ha sido comunicado por un residente y no ha sido verificado todavia por el proyecto. Redactalo como comunicacion de un ciudadano, sin afirmar que ha sido comprobado.',
}

function buildPrompt({ fecha, origen, hecho }) {
  return `Redacta una carta formal y concisa en espanol al Ayuntamiento de A Coruna sobre la siguiente incidencia. La carta debe:
- Empezar exactamente con la linea "A Coruna, a ${fecha}", copiada literalmente tal cual, sin calcular ni inventar ninguna fecha
- Dirigirse a "Excmo. Ayuntamiento de A Coruna, Concejalia de Medio Ambiente y Servicios Urbanos"
- Describir la incidencia con claridad y precision institucional
- Solicitar actuacion en un plazo razonable
- Usar vocabulario municipal: "incidencia", "residuos", "no conformidad", "servicio de limpieza"
- Terminar con "${SIGN_OFF[origen]}"

${PROVENANCE[origen]}

Reglas que no puedes romper:
- Cita solo los datos que aparecen abajo. No inventes calles, numeros de portal, fechas, nombres de tecnicos ni numeros de expediente.
- No atribuyas responsabilidad a ninguna persona ni empresa concreta.
- Si un dato falta, omitelo en silencio. No escribas corchetes ni marcadores de posicion.
- Entre 110 y 180 palabras.

${hecho}

Escribe unicamente el texto de la carta, sin comentarios previos ni posteriores.`
}

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

  const body = req.body || {}
  const { categoria, severidad, localizacion, zona, fecha: fechaHecho, descripcion } = body
  const origen = body.origen === 'submission' ? 'submission' : 'record'

  if (!localizacion && !zona) {
    return res
      .status(400)
      .json({ error: 'A location is required before a letter can be drafted.' })
  }

  // Computed here, in Europe/Madrid, and copied literally by the model.
  const fecha = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  // Only fields that actually carry a value reach the model. An absent field is
  // left out entirely rather than sent empty, so there is nothing to pad.
  const hecho = [
    ['Tipo de incidencia', CATEGORY_ES[categoria] || categoria],
    ['Ubicacion exacta', localizacion],
    ['Barrio', zona],
    ['Fecha de constatacion', fechaHecho],
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
      messages: [{ role: 'user', content: buildPrompt({ fecha, origen, hecho }) }],
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
      fecha,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    })
  } catch (err) {
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500
    console.error('[carta] request failed', status, err?.message)
    return res.status(status).json({ error: err?.message || 'Request to Claude failed.' })
  }
}
