import { supabase } from '../lib/supabaseClient.js'

const BUCKET = 'submission-photos'

// Mirrors the bucket's own limits in db/submissions.sql. Checked here only to
// fail fast with a readable message; Storage enforces the real ones, so a
// crafted client gains nothing by skipping this.
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

// Uploads to the private submission-photos bucket. anon has insert and nothing
// else there: the file cannot be listed, read, replaced or deleted from a
// browser afterwards. Returns the stored path.
async function uploadPhoto(file) {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error('La foto supera los 4 MB.')
  }
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    throw new Error('Formato no admitido. Usa JPG, PNG, WEBP o HEIC.')
  }
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

// Writes to public.submissions, never to public.records. The dataset is fed by
// scraping only; a submission is an unverified claim that sits in a quarantine
// table until a human reviews it. See db/submissions.sql.
//
// anon holds insert privilege on six columns and nothing else, so the insert
// cannot return the row it wrote. Do not add .select() here, it fails with a
// permission error by design.
export async function submitReport({ categoria, localizacion, descripcion, lat, lng, photoFile }) {
  // Photo first: if it fails, nothing is written, so there is no row pointing
  // at a file that does not exist.
  const imagen = photoFile ? await uploadPhoto(photoFile) : null

  const { error } = await supabase.from('submissions').insert({
    categoria,
    localizacion: localizacion.trim(),
    descripcion: descripcion?.trim() || null,
    lat: lat ?? null,
    lng: lng ?? null,
    imagen,
  })
  if (error) throw error
}

// Calls the serverless function in app/api/carta.js, which holds the API key.
// The browser never sees a credential.
//
// payload.origen is "record" for a row already in the audited dataset, or
// "submission" for something a citizen just reported. It decides how the letter
// is signed and whether it claims the fact was verified.
export async function draftCarta(payload) {
  const response = await fetch('/api/carta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `La solicitud falló con el estado ${response.status}`)
  }
  return data
}
