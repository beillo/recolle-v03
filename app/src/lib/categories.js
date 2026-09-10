// The six values in docs/schema.md schema v2, one place so the map, the legend
// and the side panel cannot drift apart.
//
// Labels and helper text are carried over from v0.2's src/data/categories.js
// and translated from Spanish, so the two versions describe the same six things
// the same way. The Spanish wording survives where it matters, in the letter
// the model drafts, which is addressed to a Spanish institution.
export const CATEGORIES = {
  container_issue: {
    label: 'Full container',
    desc: 'Overflowing container, broken lid, or badly placed',
    icon: 'Trash2',
  },
  illegal_dumping: {
    label: 'Illegal dumping',
    desc: 'Waste left in a place not meant for it',
    icon: 'Ban',
  },
  bulk_waste: {
    label: 'Bulk waste',
    desc: 'Furniture, appliances or other large items abandoned',
    icon: 'Sofa',
  },
  urban_damage: {
    label: 'Urban damage',
    desc: 'Graffiti, broken street furniture, potholes, other damage',
    icon: 'ShieldAlert',
  },
  circular_item: {
    label: 'Item available',
    desc: 'Item in good condition, left out for reuse',
    icon: 'Gift',
  },
  other: {
    label: 'Other',
    desc: 'Anything the categories above do not cover',
    icon: 'MoreHorizontal',
  },
}

export const CATEGORY_LABELS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([key, { label }]) => [key, label]),
)

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

export const ALL_CATEGORIES = Object.keys(CATEGORIES)
