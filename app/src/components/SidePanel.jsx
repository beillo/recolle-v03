import { useState } from 'react'
import { X, Copy, Check, Send, FileText, Loader } from 'lucide-react'

import { ALL_CATEGORIES, CATEGORY_LABELS, MARKER_COLOURS, FALLBACK_COLOUR } from '../lib/categories.js'
import { draftCarta, submitReport } from '../data/submissions.js'

const ICON = { size: 14, strokeWidth: 1.75 }

// Haiku 4.5 list price, dollars per million tokens. Shown so the cost of a
// draft is visible at the point it is incurred rather than discovered on an
// invoice. Update if the model or its price changes.
const PRICE_IN = 1.0
const PRICE_OUT = 5.0

function formatCost({ input_tokens, output_tokens }) {
  const usd = (input_tokens / 1e6) * PRICE_IN + (output_tokens / 1e6) * PRICE_OUT
  return `${input_tokens} in / ${output_tokens} out, about $${usd.toFixed(4)}`
}

function NotifyTab({ record }) {
  const [carta, setCarta] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  if (!record) {
    return (
      <p className="panel-empty">
        Select a marker on the map to draft a notification about that record.
      </p>
    )
  }

  async function handleDraft() {
    setLoading(true)
    setError(null)
    setCarta(null)
    setUsage(null)
    try {
      const data = await draftCarta(record)
      setCarta(data.carta)
      setUsage(data.usage)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(carta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('The browser blocked clipboard access. Select the text and copy it by hand.')
    }
  }

  const colour = MARKER_COLOURS[record.categoria] || FALLBACK_COLOUR

  return (
    <>
      <div className="panel-record">
        <span className="panel-record-cat" style={{ color: colour }}>
          {CATEGORY_LABELS[record.categoria] || record.categoria}
          {record.severidad != null && ` / severidad ${record.severidad}`}
        </span>
        <span className="panel-record-id">Record {record.id}</span>
        <p className="panel-record-loc">
          {record.localizacion}
          {record.zona && ` · ${record.zona}`}
        </p>
        {record.fecha && <p className="panel-record-date">{record.fecha}</p>}
      </div>

      <button className="panel-button" onClick={handleDraft} disabled={loading}>
        {loading ? (
          <>
            <Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" />
            Drafting
          </>
        ) : (
          <>
            <FileText size={ICON.size} strokeWidth={ICON.strokeWidth} />
            {carta ? 'Draft again' : 'Draft notification'}
          </>
        )}
      </button>

      {error && <p className="panel-error">{error}</p>}

      {carta && (
        <div className="panel-carta">
          <textarea value={carta} onChange={(e) => setCarta(e.target.value)} rows={14} />
          <div className="panel-carta-foot">
            <button className="panel-button ghost" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check size={ICON.size} strokeWidth={ICON.strokeWidth} /> Copied
                </>
              ) : (
                <>
                  <Copy size={ICON.size} strokeWidth={ICON.strokeWidth} /> Copy
                </>
              )}
            </button>
            {usage && <span className="panel-usage">{formatCost(usage)}</span>}
          </div>
          <p className="panel-note">
            Draft only. Read it before sending, and check every street name and date
            against the record above.
          </p>
        </div>
      )}
    </>
  )
}

function ReportTab() {
  const [categoria, setCategoria] = useState('illegal_dumping')
  const [localizacion, setLocalizacion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      await submitReport({ categoria, localizacion, descripcion })
      setSent(true)
      setLocalizacion('')
      setDescripcion('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="panel-sent">
        <Check size={20} strokeWidth={ICON.strokeWidth} />
        <p>Submission received. It goes to a review queue, not to the map.</p>
        <button className="panel-button ghost" onClick={() => setSent(false)}>
          Send another
        </button>
      </div>
    )
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <p className="panel-note">
        This does not add a point to the map. The dataset is built from scraped
        sources only, so a submission waits in a review queue until a person
        checks it.
      </p>

      <label>
        Category
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Location
        <input
          type="text"
          value={localizacion}
          onChange={(e) => setLocalizacion(e.target.value)}
          placeholder="Street and number, or a nearby landmark"
          minLength={3}
          maxLength={200}
          required
        />
      </label>

      <label>
        Description
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder="What is there, and since when if you know"
        />
      </label>

      {error && <p className="panel-error">{error}</p>}

      <button className="panel-button" type="submit" disabled={sending || localizacion.trim().length < 3}>
        {sending ? (
          <>
            <Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Sending
          </>
        ) : (
          <>
            <Send size={ICON.size} strokeWidth={ICON.strokeWidth} /> Submit
          </>
        )}
      </button>
    </form>
  )
}

export default function SidePanel({ open, tab, onTab, onClose, record }) {
  if (!open) return null
  return (
    <aside className="side-panel">
      <header className="panel-head">
        <div className="panel-tabs">
          <button
            className={tab === 'notify' ? 'active' : ''}
            onClick={() => onTab('notify')}
          >
            Notify
          </button>
          <button
            className={tab === 'report' ? 'active' : ''}
            onClick={() => onTab('report')}
          >
            Report
          </button>
        </div>
        <button className="panel-close" onClick={onClose} aria-label="Close panel">
          <X size={16} strokeWidth={ICON.strokeWidth} />
        </button>
      </header>

      <div className="panel-body">
        {tab === 'notify' ? <NotifyTab record={record} /> : <ReportTab />}
      </div>
    </aside>
  )
}
