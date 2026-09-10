// The six values in docs/schema.md schema v2, one place so the map, the legend
// and the side panel cannot drift apart.
export const CATEGORY_LABELS = {
  circular_item: 'Circular item',
  illegal_dumping: 'Illegal dumping',
  bulk_waste: 'Bulk waste',
  urban_damage: 'Urban damage',
  container_issue: 'Container issue',
  other: 'Other',
}

// Resolved hex, not var(--token): Leaflet paints markers onto an SVG layer and
// cannot read CSS custom properties.
export const MARKER_COLOURS = {
  circular_item: '#00c188',
  illegal_dumping: '#ff5a5f',
  bulk_waste: '#f5a524',
  urban_damage: '#3da5f5',
}

export const FALLBACK_COLOUR = '#8f8f8f'

// Only the four in use on the map get a legend row and a colour. The other two
// enum values are selectable in the report form but have never appeared in the
// dataset.
export const PLOTTED_CATEGORIES = [
  'circular_item',
  'illegal_dumping',
  'bulk_waste',
  'urban_damage',
]

export const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS)
