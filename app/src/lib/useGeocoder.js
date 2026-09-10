import { useCallback, useRef, useState } from 'react'

// Address autocomplete, carried over from v0.2's useGeocoder hook.
//
// Photon is the same geocoder the capture pipeline uses, so a submitted
// address is resolved by the same service that placed every record on the map.
//
// Two things from v0.2 are deliberately not copied:
//   - a 'User-Agent' header. Browsers forbid scripts from setting it, so that
//     header was silently dropped on every request v0.2 ever made.
//   - the wider bbox. It is kept close to v0.2's because a resident may well
//     be reporting from the edge of the metro area, but see RANK below: the
//     real fix for the wrong-municipality problem is ranking, not the box.
const PHOTON = 'https://photon.komoot.io'
const BBOX = '-8.55,43.20,-8.25,43.45'
const DEBOUNCE_MS = 200
const MIN_CHARS = 2

// Photon treats bbox as a bias, not a filter, so a query for a real A Coruna
// street can still put a same-named street in a neighbouring concello first.
// Searching "Tornos" returns Os Tornos in Sada above Rua Tornos in A Coruna,
// which is the exact collision recorded against record 022 in the capture
// notes. Ranking A Coruna first, and always showing the municipality on the
// row, means the user cannot pick the wrong one without seeing it.
function rank(a, b) {
  const score = (s) => (/coru/i.test(s.city || '') ? 0 : 1)
  return score(a) - score(b)
}

function toSuggestion(feature, typedNumber) {
  const { name, street, city, district, housenumber, postcode } = feature.properties
  const [lng, lat] = feature.geometry.coordinates
  const streetName = name || street
  // v0.2's trick, kept: if the user typed a number and Photon did not return
  // one, the number the user typed is the better guess.
  const number = housenumber || typedNumber
  const label = number ? `${streetName} ${number}` : streetName
  return {
    lat,
    lng,
    label,
    city: city || 'A Coruña',
    district: district || null,
    postcode: postcode || null,
    address: `${label}, ${city || 'A Coruña'}`,
  }
}

export function useGeocoder() {
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const timer = useRef(null)
  // Guards against a slow early request landing after a faster later one and
  // overwriting fresher results.
  const seq = useRef(0)

  const search = useCallback((query) => {
    clearTimeout(timer.current)
    if (query.trim().length < MIN_CHARS) {
      setSuggestions([])
      setSearching(false)
      return
    }
    setSearching(true)
    const mine = ++seq.current

    timer.current = setTimeout(async () => {
      const url =
        `${PHOTON}/api/?q=${encodeURIComponent(query)}&limit=6&bbox=${BBOX}`
      try {
        const res = await fetch(url, { headers: { 'Accept-Language': 'es' } })
        const data = await res.json()
        if (mine !== seq.current) return
        const typedNumber = query.match(/\d+/)?.[0]
        const rows = (data.features || [])
          .map((f) => toSuggestion(f, typedNumber))
          .filter((s) => s.label)
          .sort(rank)
        setSuggestions(rows)
      } catch {
        if (mine === seq.current) setSuggestions([])
      } finally {
        if (mine === seq.current) setSearching(false)
      }
    }, DEBOUNCE_MS)
  }, [])

  const clear = useCallback(() => {
    clearTimeout(timer.current)
    seq.current++
    setSuggestions([])
    setSearching(false)
  }, [])

  return { suggestions, searching, search, clear }
}

// Used by the "usar mi ubicación" button. v0.2 reverse geocoded through
// Nominatim; this uses Photon, so the whole feature talks to one service.
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`${PHOTON}/reverse?lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'es' },
    })
    const data = await res.json()
    const feature = data.features?.[0]
    if (!feature) throw new Error('sin resultado')
    return toSuggestion(feature, null)
  } catch {
    // A coordinate with no name is still a usable location.
    return {
      lat,
      lng,
      label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city: 'A Coruña',
      district: null,
      postcode: null,
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    }
  }
}
