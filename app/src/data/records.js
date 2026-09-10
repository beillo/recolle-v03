import { supabase } from '../lib/supabaseClient.js'

// Bundle the capture images straight from data/images/ at the repo root.
// Keys come back as paths relative to this file, so they are normalised to the
// "data/images/017-1.jpg" form the records themselves use. Images stay local
// files for now, only the record data itself moved to Supabase in Etapa 4.6.
const imageModules = import.meta.glob('../../../data/images/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const imageUrls = Object.fromEntries(
  Object.entries(imageModules).map(([path, url]) => [
    path.replace('../../../', ''),
    url,
  ]),
)

// Records sharing a coordinate would stack and hide each other. Spread them
// evenly around a small circle instead. The offset is derived from the record's
// position in the group, not random, so a marker does not move between reloads.
const SPREAD_METRES = 70
const METRES_PER_DEG_LAT = 111320

function spread(lat, lng, index, total) {
  if (total < 2) return { lat, lng }
  const angle = (2 * Math.PI * index) / total
  const dLat = (SPREAD_METRES * Math.cos(angle)) / METRES_PER_DEG_LAT
  const dLng =
    (SPREAD_METRES * Math.sin(angle)) /
    (METRES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  return { lat: lat + dLat, lng: lng + dLng }
}

// How the coordinate on a row was actually obtained. Three cases, not two.
//
// The old version read only `precision` and sent everything that was not
// "neighbourhood" to "localizacion". That mislabelled the Concello records:
// that source publishes its own latitude and longitude in the page markup, so
// no geocoding ever runs on them, yet they were drawn with the dashed ring
// that the legend calls "ubicado desde la localización, menor precisión". The
// map was making a false claim about the provenance of those coordinates.
//
// `query` is the exact discriminator. It holds the string sent to Photon and
// is null on every row that never went through geocoding, so it separates a
// geocoded guess from a coordinate the source itself published.
function sourceOf(row) {
  if (row.precision === 'neighbourhood') return 'zona'
  if (row.query) return 'localizacion'
  return 'fuente'
}

// Binding for the records_by_zona() RPC, Etapa 4.7's "count records grouped by
// zona" query from docs/queries.md. Nothing renders it since the zona panel was
// taken off the map, but the query is a stage deliverable and the function
// stays as its client side entry point. Delete it only if 4.7 is rescoped.
export async function loadZonaCounts() {
  const { data, error } = await supabase.rpc('records_by_zona')
  if (error) throw error
  return data
}

export async function loadRecords() {
  const { data, error } = await supabase.from('records').select('*')
  if (error) throw error

  const placed = []
  const skipped = []

  for (const row of data) {
    if (row.lat == null || row.lng == null) {
      skipped.push({ id: row.id, reason: row.reason })
      continue
    }
    placed.push({
      ...row,
      fuente: { tipo: row.fuente_tipo, url: row.fuente_url, grupo: row.fuente_grupo },
      images: (row.imagen || []).map((path) => ({ path, url: imageUrls[path] })),
      source: sourceOf(row),
      groupKey: `${row.lat},${row.lng}`,
    })
  }

  const groups = new Map()
  for (const item of placed) {
    if (!groups.has(item.groupKey)) groups.set(item.groupKey, [])
    groups.get(item.groupKey).push(item)
  }

  const plotted = []
  for (const group of groups.values()) {
    group.forEach((item, index) => {
      const { lat, lng } = spread(item.lat, item.lng, index, group.length)
      plotted.push({ ...item, lat, lng })
    })
  }

  return {
    plotted,
    skipped,
    totalRecords: data.length,
    // Whether zona was confirmed is independent of precision: record 033
    // has zona set but precision "street", an official Concello point, not
    // a centroid guess. source (above) still answers "how precise is this
    // coordinate", these two answer "was a zona confirmed for this record".
    plottedByZona: plotted.filter((r) => r.zona != null),
    plottedByLocalizacion: plotted.filter((r) => r.zona == null),
  }
}
