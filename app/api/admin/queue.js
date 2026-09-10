import { guard, db, methodNotAllowed } from '../_admin.js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// The review queue. This is the half that was missing: the interface promises
// every submission is checked by a person, and until now no person had a way
// to see one.
//
// GET  ?estado=pending           list the queue
// POST { id, action, ... }       accept, reject, or promote into records
export default async function handler(req, res) {
  if (guard(req, res)) return

  try {
    if (req.method === 'GET') {
      const estado = ['pending', 'accepted', 'rejected'].includes(req.query.estado)
        ? req.query.estado
        : 'pending'
      const { data } = await db(
        `submissions?select=*&estado=eq.${estado}&order=created_at.desc&limit=100`,
      )

      // A photo sits in a private bucket, so the browser cannot fetch it with
      // the public key. Sign a short lived URL per row instead of making the
      // bucket public.
      const rows = await Promise.all(
        data.map(async (row) => {
          if (!row.imagen) return row
          try {
            const signed = await fetch(
              `${SUPABASE_URL}/storage/v1/object/sign/submission-photos/${row.imagen}`,
              {
                method: 'POST',
                headers: {
                  apikey: SERVICE_KEY,
                  Authorization: `Bearer ${SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ expiresIn: 600 }),
              },
            )
            if (!signed.ok) return row
            const { signedURL } = await signed.json()
            return { ...row, photoUrl: `${SUPABASE_URL}/storage/v1${signedURL}` }
          } catch {
            return row
          }
        }),
      )

      return res.status(200).json({ rows })
    }

    if (req.method === 'POST') {
      const { id, action } = req.body || {}
      if (!id || !['accept', 'reject', 'promote'].includes(action)) {
        return res.status(400).json({ error: 'Falta id o la acción no es válida.' })
      }

      if (action !== 'promote') {
        await db(`submissions?id=eq.${id}`, {
          method: 'PATCH',
          body: { estado: action === 'accept' ? 'accepted' : 'rejected' },
        })
        return res.status(200).json({ ok: true })
      }

      // Promotion is the only path from the quarantine table into the audited
      // dataset, and it is a deliberate human act, never automatic. The new
      // record keeps a fuente pointing back at the submission it came from, so
      // its provenance stays legible.
      const { data: found } = await db(`submissions?select=*&id=eq.${id}&limit=1`)
      const sub = found?.[0]
      if (!sub) return res.status(404).json({ error: 'Ese aviso ya no existe.' })
      if (sub.estado === 'accepted' && sub.promoted_to) {
        return res.status(409).json({ error: `Ya se promovió al registro ${sub.promoted_to}.` })
      }
      if (sub.lat == null || sub.lng == null) {
        return res.status(422).json({
          error: 'Este aviso no tiene coordenada, no puede entrar en el mapa. Recházalo o corrígelo en Supabase.',
        })
      }

      const { data: last } = await db('records?select=id&order=id.desc&limit=1')
      const nextId = String(Number(last?.[0]?.id ?? 0) + 1).padStart(3, '0')

      await db('records', {
        method: 'POST',
        body: {
          id: nextId,
          categoria: sub.categoria,
          severidad: 1,
          localizacion: sub.localizacion,
          fecha: String(sub.created_at).slice(0, 10),
          fuente_tipo: 'submission',
          fuente_url: `submission:${sub.id}`,
          fuente_grupo: null,
          descripcion: sub.descripcion || sub.localizacion,
          imagen: sub.imagen ? [`submission-photos/${sub.imagen}`] : [],
          // A resident's report is not a verified observation. It enters the
          // dataset flagged lower than a scraped and checked record.
          confidence: 0.5,
          zona: null,
          lat: sub.lat,
          lng: sub.lng,
          precision: 'address',
          query: null,
          match: null,
          reason: null,
        },
      })

      await db(`submissions?id=eq.${id}`, {
        method: 'PATCH',
        body: { estado: 'accepted', promoted_to: nextId },
      })

      return res.status(200).json({ ok: true, promoted_to: nextId })
    }

    return methodNotAllowed(req, res, ['GET', 'POST'])
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
