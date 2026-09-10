import { guard, methodNotAllowed } from '../_admin.js'

// Replaces typing `node --env-file=.env scripts/fetch-apify.js` by hand.
//
// It does what that script does, fetch the items from the last successful run
// of the actor, but it cannot write to data/raw/ because a serverless function
// has no repository to write into. So it returns the batch as a download and a
// summary, and the local script stays as the way to put the file on disk.
//
// Deliberately does NOT insert anything. The capture pipeline strips personal
// data, downloads images and assigns ids, and none of that happens here. This
// button answers "is there anything new and how much", not "import it".
const ACTOR_ID = 'apify~facebook-groups-scraper'

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST'])
  if (guard(req, res)) return

  const token = process.env.APIFY_TOKEN
  if (!token) {
    return res.status(503).json({
      error: 'APIFY_TOKEN no está configurado en este despliegue.',
      missing: 'APIFY_TOKEN',
    })
  }

  try {
    const runRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/runs/last?token=${token}&status=SUCCEEDED`,
    )
    if (!runRes.ok) {
      return res.status(502).json({ error: `Apify respondió ${runRes.status} al pedir la última ejecución.` })
    }
    const run = (await runRes.json()).data

    const itemsRes = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/runs/last/dataset/items?token=${token}&status=SUCCEEDED`,
    )
    if (!itemsRes.ok) {
      return res.status(502).json({ error: `Apify respondió ${itemsRes.status} al pedir los items.` })
    }
    const items = await itemsRes.json()

    // Post URLs are the dedup key the pipeline uses, so counting distinct ones
    // says how much of this batch is actually new material.
    const urls = [...new Set(items.map((i) => i?.url).filter(Boolean))]

    res.status(200).json({
      run: {
        id: run?.id ?? null,
        startedAt: run?.startedAt ?? null,
        finishedAt: run?.finishedAt ?? null,
        status: run?.status ?? null,
      },
      total: items.length,
      urlsUnicas: urls.length,
      // Enough to eyeball the batch without shipping the whole payload, which
      // still contains names and comments until the local pipeline strips them.
      muestra: items.slice(0, 5).map((i) => ({
        url: i?.url ?? null,
        fecha: i?.time ?? null,
        texto: String(i?.text ?? '').slice(0, 160),
      })),
      siguiente:
        'Para incorporarlo: node --env-file=.env scripts/fetch-apify.js, y después el pipeline de captura, que quita los datos personales y descarga las imágenes.',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
