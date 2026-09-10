import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { MapPin, Calendar, ImageOff, Crosshair, PanelRight } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

import { loadRecords } from './data/records.js'
import SidePanel from './components/SidePanel.jsx'
import {
  CATEGORY_LABELS,
  MARKER_COLOURS,
  FALLBACK_COLOUR,
  PLOTTED_CATEGORIES,
} from './lib/categories.js'

const ICON = { size: 13, strokeWidth: 1.75 }

const A_CORUNA = [43.3623, -8.4115]

function Legend({ plotted }) {
  const present = new Set(plotted.map((r) => r.categoria))
  return (
    <div className="legend">
      {PLOTTED_CATEGORIES.map((cat) => (
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

    </Popup>
  )
}

export default function App() {
  const [records, setRecords] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState('notify')
  const [selected, setSelected] = useState(null)

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
        <button
          className="panel-toggle"
          onClick={() => setPanelOpen((v) => !v)}
          aria-label={panelOpen ? 'Close side panel' : 'Open side panel'}
        >
          <PanelRight size={15} strokeWidth={ICON.strokeWidth} />
          {panelOpen ? 'Hide panel' : 'Notify / Report'}
        </button>
      </header>

      <Legend plotted={plotted} />

      <div className="map-row">
      <div className="map-wrap">
        <MapContainer center={A_CORUNA} zoom={13} scrollWheelZoom>
          {/*
            Esri Light Gray, replacing CartoDB Positron. Carto now stamps
            "API KEY REQUIRED" across its public basemap tiles and still
            answers 200 with a valid PNG, so the failure was invisible to the
            console and only showed on screen. Esri needs no key.
            Two layers: Esri splits the canvas into a label free Base and a
            separate Reference layer carrying the street names, and the map is
            about placing incidents on streets, so both are needed.
            Note the tile path is {z}/{y}/{x}, y before x, not Leaflet's usual
            order, and there is no {s} subdomain.
          */}
          <TileLayer
            attribution='Tiles &copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community'
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer
            url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          />
          {plotted.map((record) => {
            const approximate = record.source !== 'zona'
            return (
            <CircleMarker
              key={record.id}
              center={[record.lat, record.lng]}
              radius={9}
              eventHandlers={{
                click: () => {
                  setSelected(record)
                  setPanelTab('notify')
                  setPanelOpen(true)
                },
              }}
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

      <SidePanel
        open={panelOpen}
        tab={panelTab}
        onTab={setPanelTab}
        onClose={() => setPanelOpen(false)}
        record={selected}
      />
      </div>
    </div>
  )
}
