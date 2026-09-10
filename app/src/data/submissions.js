import { supabase } from '../lib/supabaseClient.js'

// Writes to public.submissions, never to public.records. The dataset is fed by
// scraping only; a submission is an unverified claim that sits in a quarantine
// table until a human reviews it. See db/submissions.sql.
//
// anon holds insert privilege on these five columns and nothing else, so the
// insert cannot return the row it wrote. Do not add .select() here, it will
// fail with a permission error.
export async function submitReport({ categoria, localizacion, descripcion, lat, lng }) {
  const { error } = await supabase.from('submissions').insert({
    categoria,
    localizacion: localizacion.trim(),
    descripcion: descripcion?.trim() || null,
    lat: lat ?? null,
    lng: lng ?? null,
  })
  if (error) throw error
}

// Calls the serverless function in app/api/carta.js, which holds the API key.
// The browser never sees a credential.
export async function draftCarta(record) {
  const response = await fetch('/api/carta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categoria: record.categoria,
      severidad: record.severidad,
      localizacion: record.localizacion,
      zona: record.zona,
      fecha: record.fecha,
      descripcion: record.descripcion,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`)
  }
  return data
}
