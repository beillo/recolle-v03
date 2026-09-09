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

// precision "neighbourhood" only ever comes from a confirmed zona centroid,
// see db/seed.sql and the locate() logic it replaced, so it is what "source"
// used to encode: zona if neighbourhood, geocoded localizacion otherwise.
function sourceFromPrecision(precision) {
  return precision === 'neighbourhood' ? 'zona' : 'localizacion'
}

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
      source: sourceFromPrecision(row.precision),
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
