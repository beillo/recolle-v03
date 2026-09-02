import rawRecords from '../../../data/records.json'
import zonaCoords from './zonaCoords.json'

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

// Records sharing a zona would stack on the exact same coordinate and hide each
// other. Spread them evenly around a small circle instead. The offset is derived
// from the record's position in the group, not random, so a marker does not move
// between reloads.
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

function build() {
  const plotted = []
  const skipped = []

  // Group by zona first so the spread knows how many share each coordinate.
  const byZona = new Map()
  for (const record of rawRecords) {
    if (!record.zona || !zonaCoords[record.zona]) {
      skipped.push({
        id: record.id,
        reason: record.zona
          ? `zona "${record.zona}" is not in zonaCoords.json`
          : 'no zona value',
      })
      continue
    }
    if (!byZona.has(record.zona)) byZona.set(record.zona, [])
    byZona.get(record.zona).push(record)
  }

  for (const [zona, group] of byZona) {
    const base = zonaCoords[zona]
    group.forEach((record, index) => {
      const { lat, lng } = spread(base.lat, base.lng, index, group.length)
      plotted.push({
        ...record,
        lat,
        lng,
        sharesZona: group.length > 1,
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
export const totalRecords = rawRecords.length
export { zonaCoords }
