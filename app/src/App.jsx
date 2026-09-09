import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { MapPin, Calendar, ImageOff, ExternalLink, Crosshair } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

import { loadRecords, loadZonaCounts } from './data/records.js'

const ICON = { size: 13, strokeWidth: 1.75 }

const CATEGORY_COLOURS = {
  circular_item: 'var(--cat-circular)',
  illegal_dumping: 'var(--cat-dumping)',
  bulk_waste: 'var(--cat-bulk)',
  urban_damage: 'var(--cat-damage)',
}

// Resolved values, since Leaflet paints markers onto a canvas/SVG layer and
// cannot read the CSS custom properties above.
const MARKER_COLOURS = {
  circular_item: '#00c188',
  illegal_dumping: '#ff5a5f',
  bulk_waste: '#f5a524',
  urban_damage: '#3da5f5',
}
const FALLBACK_COLOUR = '#8f8f8f'

const CATEGORY_LABELS = {
  circular_item: 'Circular item',
  illegal_dumping: 'Illegal dumping',
  bulk_waste: 'Bulk waste',
  urban_damage: 'Urban damage',
}

const A_CORUNA = [43.3623, -8.4115]

function Legend({ plotted }) {
  const present = new Set(plotted.map((r) => r.categoria))
  return (
    <div className="legend">
      {Object.keys(CATEGORY_COLOURS).map((cat) => (
        <span
          key={cat}
          className={`legend-item${present.has(cat) ? '' : ' absent'}`}
          style={{ color: MARKER_COLOURS[cat] }}
        >
          <span
            className="swatch"
            style={{ background: MARKER_COLOURS[cat] }}
          />
          <span style={{ color: 'var(--muted)' }}>
            {CATEGORY_LABELS[cat]}
            {present.has(cat) ? '' : ' (none plotted)'}
          </span>
        </span>
      ))}
      <span className="legend-item precision-key">
        <span className="swatch hollow" />
        <span style={{ color: 'var(--muted)' }}>
          Dashed outline: placed from localizacion, lower precision
        </span>
      </span>
      <span className="note">
        Records sharing a coordinate are spread apart so they stay clickable.
      </span>
    </div>
  )
}

function ZonaPanel({ counts }) {
  return (
    <div className="zona-panel">
      <span className="zona-panel-title">Records by zona</span>
      <ul>
        {counts.map(({ zona, count }) => (
          <li key={zona ?? 'none'}>
            <span>{zona ?? 'sin zona confirmada'}</span>
            <strong>{count}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecordPopup({ record }) {
  const colour = MARKER_COLOURS[record.categoria] || FALLBACK_COLOUR
  return (
    <Popup>
      <span className="popup-cat" style={{ color: colour }}>
        {CATEGORY_LABELS[record.categoria] || record.categoria}
        {record.severidad != null && ` / severidad ${record.severidad}`}
      </span>

      <p className="popup-desc">{record.descripcion}</p>

      <div className="popup-meta">
        <span className="row">
          <MapPin size={ICON.size} strokeWidth={ICON.strokeWidth} />
          <span>
            {record.localizacion}
            {record.zona && ` · ${record.zona}`}
          </span>
        </span>
        {record.fecha && (
          <span className="row">
            <Calendar size={ICON.size} strokeWidth={ICON.strokeWidth} />
            <span>{record.fecha}</span>
          </span>
        )}
        <span className="row">
          <Crosshair size={ICON.size} strokeWidth={ICON.strokeWidth} />
          <span>
            {record.source === 'zona'
              ? `Confirmed zona, neighbourhood centre`
              : `Geocoded from localizacion (${record.precision}): ${record.match}`}
          </span>
        </span>
      </div>

      {record.images.length > 0 && (
        <div className="popup-images">
          {record.images.map((image) =>
            image.url ? (
              <img
                key={image.path}
                src={image.url}
                alt={`Record ${record.id}`}
                loading="lazy"
              />
            ) : (
              <span key={image.path} className="popup-missing">
                <ImageOff size={ICON.size} strokeWidth={ICON.strokeWidth} />{' '}
                {image.path} not found
              </span>
            ),
          )}
        </div>
      )}

      {record.fuente?.url && (
        <a
          className="popup-source"
          href={record.fuente.url}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={ICON.size} strokeWidth={ICON.strokeWidth} />
          Original post
        </a>
      )}
    </Popup>
  )
}

export default function App() {
  const [records, setRecords] = useState(null)
  const [zonaCounts, setZonaCounts] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    loadRecords()
      .then((result) => {
        setRecords(result)
        const { totalRecords, plottedByZona, plottedByLocalizacion, plotted, skipped } = result
        console.log(
          `[recolle] ${totalRecords} records: ` +
            `${plottedByZona.length} plotted via confirmed zona, ` +
            `${plottedByLocalizacion.length} via localizacion fallback, ` +
            `${skipped.length} still skipped`,
        )
        console.table(
          plotted.map((r) => ({
            id: r.id,
            via: r.source,
            precision: r.precision,
            match: r.match,
          })),
        )
        if (skipped.length) {
          console.table(skipped)
        }
      })
      .catch((err) => setLoadError(err.message))

    loadZonaCounts()
      .then((counts) => {
        setZonaCounts(counts)
        console.log('[recolle] records_by_zona:')
        console.table(counts)
      })
      .catch((err) => console.error('[recolle] records_by_zona failed:', err.message))
  }, [])

  if (loadError) {
    return <div className="app-message">Failed to load records: {loadError}</div>
  }
  if (!records) {
    return <div className="app-message">Loading records…</div>
  }

  const { plotted, skipped, totalRecords, plottedByZona, plottedByLocalizacion } = records

  return (
    <div className="app">
      <header className="header">
        <h1 className="wordmark">
          Recolle<span className="dot">.</span>
        </h1>
        <span className="stage">Etapa 3 / minimal map</span>
        <div className="counts">
          <span className="count">
            <strong>{plottedByZona.length}</strong> via zona
          </span>
          <span className="count">
            <strong>{plottedByLocalizacion.length}</strong> via localizacion
          </span>
          <span className="count">
            <strong>{skipped.length}</strong> unplaced
          </span>
          <span className="count">
            <strong>{totalRecords}</strong> captured
          </span>
        </div>
      </header>

      <Legend plotted={plotted} />

      <div className="map-wrap">
        {zonaCounts && <ZonaPanel counts={zonaCounts} />}
        <MapContainer center={A_CORUNA} zoom={13} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {plotted.map((record) => {
            const approximate = record.source !== 'zona'
            return (
            <CircleMarker
              key={record.id}
              center={[record.lat, record.lng]}
              radius={9}
              pathOptions={{
                // Same colour by categoria either way. Precision is carried by
                // the outline: solid ring for a confirmed zona, dashed ring and
                // a lighter fill for a coordinate geocoded from localizacion.
                color: approximate
                  ? MARKER_COLOURS[record.categoria] || FALLBACK_COLOUR
                  : '#0a0a0a',
                weight: 1.75,
                dashArray: approximate ? '3 3' : undefined,
                fillColor:
                  MARKER_COLOURS[record.categoria] || FALLBACK_COLOUR,
                fillOpacity: approximate ? 0.45 : 0.95,
              }}
            >
              <RecordPopup record={record} />
            </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
