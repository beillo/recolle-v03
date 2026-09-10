import { useEffect, useRef, useState } from 'react'
import { MapPin, Crosshair, X, Loader } from 'lucide-react'

import { useGeocoder, reverseGeocode } from '../lib/useGeocoder.js'

const ICON = { size: 14, strokeWidth: 1.75 }

// Address autocomplete, carried over from v0.2's LocationSearch. Same three
// parts: a debounced search with a dropdown, a "use my location" button, and a
// confirmed state once something is picked.
//
// What is new here is the municipality on every row. Photon biases by bounding
// box but does not filter, so a street name shared with a neighbouring concello
// can come back first. v0.2 folded the city into one line of text; here it is
// its own line, and rows in A Coruna are sorted to the top.
export default function LocationSearch({ value, onSelect }) {
  const [text, setText] = useState('')
  const [geoState, setGeoState] = useState(null) // null | 'loading' | 'error'
  const [geoError, setGeoError] = useState(null)
  const { suggestions, searching, search, clear } = useGeocoder()
  const boxRef = useRef(null)

  useEffect(() => {
    function onOutside(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) clear()
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [clear])

  function pick(suggestion) {
    onSelect(suggestion)
    setText('')
    clear()
  }

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setGeoError('Este navegador no ofrece geolocalización.')
      setGeoState('error')
      return
    }
    setGeoState('loading')
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        onSelect(await reverseGeocode(latitude, longitude))
        setGeoState(null)
      },
      (err) => {
        const messages = {
          1: 'Permiso denegado. Activa la ubicación para este sitio en los ajustes del navegador.',
          2: 'Posición no disponible en este momento.',
          3: 'Se agotó el tiempo de espera al localizarte.',
        }
        setGeoError(messages[err.code] || 'No se pudo obtener tu ubicación.')
        setGeoState('error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  if (value) {
    return (
      <div className="loc-confirmed">
        <MapPin size={ICON.size} strokeWidth={ICON.strokeWidth} />
        <span className="loc-address">
          <span className="loc-label">{value.label}</span>
          <span className="loc-city">
            {value.city}
            {value.district && ` · ${value.district}`}
          </span>
        </span>
        <button
          type="button"
          className="photo-remove"
          onClick={() => {
            onSelect(null)
            setGeoState(null)
          }}
          aria-label="Cambiar ubicación"
        >
          <X size={ICON.size} strokeWidth={ICON.strokeWidth} />
        </button>
      </div>
    )
  }

  return (
    <div className="loc-search" ref={boxRef}>
      <input
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          search(e.target.value)
        }}
        placeholder="Buscar dirección…"
        autoComplete="off"
      />

      <button
        type="button"
        className="panel-button ghost loc-geo"
        onClick={handleGeolocate}
        disabled={geoState === 'loading'}
      >
        {geoState === 'loading' ? (
          <><Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Localizando…</>
        ) : (
          <><Crosshair size={ICON.size} strokeWidth={ICON.strokeWidth} /> Usar mi ubicación</>
        )}
      </button>

      {geoState === 'error' && <p className="panel-error">{geoError}</p>}

      {(suggestions.length > 0 || searching) && (
        <ul className="loc-dropdown">
          {searching && suggestions.length === 0 && (
            <li className="loc-empty">Buscando…</li>
          )}
          {suggestions.map((s) => (
            <li key={`${s.lat},${s.lng},${s.label}`}>
              <button type="button" onMouseDown={() => pick(s)}>
                <span className="loc-label">{s.label}</span>
                <span className="loc-city">
                  {s.city}
                  {s.district && ` · ${s.district}`}
                  {s.postcode && ` · ${s.postcode}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
