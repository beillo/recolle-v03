import rawRecords from '../../../data/records.json'
import zonaCoords from './zonaCoords.json'
import localizacionCoords from './localizacionCoords.json'

// Bundle the capture images straight from data/images/ at the repo root.
// Keys come back as paths relative to this file, so they are normalised to the
// "data/images/017-1.jpg" form the records themselves use.
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

// A confirmed zona wins. Only when there is none does the record fall back to
// the geocoded localizacion, which is less precise and is marked as such.
function locate(record) {
  if (record.zona) {
    const hit = zonaCoords[record.zona]
    if (hit) {
      return {
        source: 'zona',
        lat: hit.lat,
        lng: hit.lng,
        groupKey: `zona:${record.zona}`,
        precision: 'neighbourhood',
        match: record.zona,
      }
    }
    return {
      source: 'skipped',
      reason: `zona "${record.zona}" is not in zonaCoords.json`,
    }
  }

  const hit = localizacionCoords[record.localizacion]
  if (!hit) {
    return {
      source: 'skipped',
      reason: 'no zona, and localizacion is not in localizacionCoords.json',
    }
  }
  if (hit.lat == null || hit.lng == null) {
    return {
      source: 'skipped',
      reason: hit.reason || 'localizacion did not geocode',
    }
  }
  return {
    source: 'localizacion',
    lat: hit.lat,
    lng: hit.lng,
    groupKey: `loc:${record.localizacion}`,
    precision: hit.precision || 'unknown',
    match: hit.match,
  }
}

function build() {
  const placed = []
  const skipped = []

  for (const record of rawRecords) {
    const located = locate(record)
    if (located.source === 'skipped') {
      skipped.push({ id: record.id, reason: located.reason })
      continue
    }
    placed.push({ record, located })
  }

  // Group by resolved coordinate so the spread knows how many share a point.
  const groups = new Map()
  for (const item of placed) {
    const key = item.located.groupKey
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }

  const plotted = []
  for (const group of groups.values()) {
    group.forEach(({ record, located }, index) => {
      const { lat, lng } = spread(
        located.lat,
        located.lng,
        index,
        group.length,
      )
      plotted.push({
        ...record,
        lat,
        lng,
        source: located.source,
        precision: located.precision,
        match: located.match,
        images: (record.imagen || []).map((path) => ({
          path,
          url: imageUrls[path],
        })),
      })
    })
  }

  return { plotted, skipped }
}

export const { plotted, skipped } = build()
export const plottedByZona = plotted.filter((r) => r.source === 'zona')
export const plottedByLocalizacion = plotted.filter(
  (r) => r.source === 'localizacion',
)
export const totalRecords = rawRecords.length
export { zonaCoords, localizacionCoords }
