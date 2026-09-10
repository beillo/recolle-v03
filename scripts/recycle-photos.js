// Photo recycling job. Deletes image files whose retention window has passed
// and then tells the database they are gone.
//
// Usage:
//   node --env-file=.env scripts/recycle-photos.js            dry run, changes nothing
//   node --env-file=.env scripts/recycle-photos.js --commit   deletes and marks
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env. The service role is
// required because records has no update policy for the public roles, which is
// deliberate: this job is privileged.
//
// THE ORDER MATTERS AND IS NOT NEGOTIABLE. File first, database second.
// Marking a record recycled before the file is actually gone leaves the map
// saying the photo was removed while the file is still in the repository, an
// invisible orphan. Failing the other way round, file gone and mark not
// written, is self healing: the record stays in the queue and the next run
// finds the file already absent and marks it.
//
// What this does NOT do: shrink .git. The images are tracked, so deleting them
// removes them from the working tree and from future deploys, while every blob
// stays in history. Reclaiming that space would mean rewriting history, which
// is a different decision and a destructive one.

import { readdir, rm, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const IMAGES_ROOT = join(ROOT, 'data', 'images')

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const commit = process.argv.includes('--commit')

if (!url || !key) {
  console.error(
    'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Uso: node --env-file=.env scripts/recycle-photos.js [--commit]',
  )
  process.exit(1)
}

async function rest(path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

// A path from the database must land inside data/images and nowhere else. The
// column is written by the capture pipeline, not by a stranger, but a path that
// escapes the directory would have this job deleting arbitrary files and the
// check costs nothing.
function safePath(relative) {
  const full = resolve(ROOT, relative)
  if (!full.startsWith(IMAGES_ROOT + sep)) {
    throw new Error(`Ruta fuera de data/images, rechazada: ${relative}`)
  }
  return full
}

// Everything below runs inside main() so the ordinary paths return instead of
// calling process.exit. Exiting while fetch keep-alive sockets are still open
// makes Node abort on Windows with a libuv assertion, printed after the real
// output, which reads like a crash on a run that actually succeeded.
async function main() {
const queue = await rest('fotos_a_reciclar?select=*&order=fecha')

if (queue.length === 0) {
  console.log('Cola vacía, no hay nada que reciclar hoy.')
  return
}

const totalFotos = queue.reduce((n, r) => n + (r.arquivos?.length ?? 0), 0)
console.log(
  `${queue.length} registros en la cola, ${totalFotos} archivos.` +
    (commit ? '' : ' Simulación, no se borra nada. Añade --commit para ejecutar.'),
)

const listos = []
const fallidos = []

for (const row of queue) {
  const dias = row.dias_de_vida
  const label = `${row.id} ${row.categoria} (${dias} días, política ${row.dias_politica})`
  let ok = true

  for (const relative of row.arquivos ?? []) {
    let full
    try {
      full = safePath(relative)
    } catch (err) {
      console.error(`  ! ${label}: ${err.message}`)
      ok = false
      continue
    }

    const existe = await stat(full).then(() => true).catch(() => false)
    if (!existe) {
      // Already gone. A previous run deleted it and failed before marking, so
      // this run finishes the job rather than treating it as an error.
      console.log(`  · ${relative} ya no estaba`)
      continue
    }
    if (!commit) {
      console.log(`  - ${relative}`)
      continue
    }
    try {
      await rm(full)
      console.log(`  x ${relative}`)
    } catch (err) {
      console.error(`  ! ${relative}: ${err.message}`)
      ok = false
    }
  }

  if (ok) listos.push(row.id)
  else fallidos.push(row.id)
}

if (!commit) {
  console.log(`\nSimulación terminada. ${listos.length} registros se marcarían.`)
  process.exit(0)
}

// Only now, and only for records whose every file is actually gone.
if (listos.length > 0) {
  const marcados = await rest('rpc/marcar_fotos_recicladas', {
    method: 'POST',
    // The parameter is named p_ids, checked against pg_get_function_arguments,
    // not guessed: PostgREST matches RPC arguments by name and a wrong one is a
    // 404, not a helpful error.
    body: JSON.stringify({ p_ids: listos }),
  })
  console.log(`\nMarcados en la base: ${marcados}`)
}

if (fallidos.length > 0) {
  console.error(
    `\n${fallidos.length} registros NO se marcaron porque algún archivo falló: ${fallidos.join(', ')}\n` +
      'Siguen en la cola y el próximo intento los recoge.',
  )
}

const restantes = await readdir(IMAGES_ROOT).then((f) => f.filter((n) => n.endsWith('.jpg')).length)
console.log(`Quedan ${restantes} imágenes en data/images.`)
console.log('Falta commitear los borrados en git.')
}

await main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
