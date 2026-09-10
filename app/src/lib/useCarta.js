import { useState } from 'react'

import { draftCarta } from '../data/submissions.js'

// Shared by the report sidebar and by the marker popup on the map. Two stages:
// it opens asking whether to notify the Ayuntamiento, and only calls the API if
// the answer is yes, so declining costs nothing.
export function useCarta() {
  const [stage, setStage] = useState(null) // null | 'ask' | 'carta'
  const [payload, setPayload] = useState(null)
  const [carta, setCarta] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function ask(nextPayload) {
    setPayload(nextPayload)
    setCarta(null)
    setUsage(null)
    setError(null)
    setStage('ask')
  }

  function close() {
    setStage(null)
  }

  async function generate() {
    setStage('carta')
    setLoading(true)
    setError(null)
    setCarta(null)
    setUsage(null)
    try {
      const data = await draftCarta(payload)
      setCarta(data.carta)
      setUsage(data.usage)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { stage, carta, setCarta, usage, loading, error, ask, close, generate }
}
