// The six values in docs/schema.md schema v2, one place so the map, the legend
// and the side panel cannot drift apart.
//
// Labels and helper text are v0.2's own Spanish, from its
// src/data/categories.js, restored verbatim on 2026-09-10 when the interface
// went back to Spanish. The enum keys stay English because they are stored
// values, checked by a constraint in db/schema.sql, and are not user facing.
export const CATEGORIES = {
  container_issue: {
    label: 'Contenedor lleno',
    desc: 'Contenedor desbordante, tapa rota o mal colocado',
    icon: 'Trash2',
  },
  illegal_dumping: {
    label: 'Vertido ilegal',
    desc: 'Residuos depositados en zona no habilitada',
    icon: 'Ban',
  },
  bulk_waste: {
    label: 'Residuo voluminoso',
    desc: 'Muebles, electrodomésticos u objetos grandes abandonados',
    icon: 'Sofa',
  },
  urban_damage: {
    label: 'Daño urbano',
    desc: 'Grafitis, mobiliario roto, socavones u otros desperfectos',
    icon: 'ShieldAlert',
  },
  circular_item: {
    label: 'Objeto disponible',
    desc: 'Objeto en buen estado disponible para reutilización',
    icon: 'Gift',
  },
  other: {
    label: 'Otro',
    desc: 'Incidencia no recogida en las categorías anteriores',
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
