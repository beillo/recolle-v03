import { useState } from 'react'
import {
  X, Copy, Check, Send, FileText, Loader,
  Trash2, Ban, Sofa, ShieldAlert, Gift, MoreHorizontal,
} from 'lucide-react'

import {
  ALL_CATEGORIES, CATEGORIES, CATEGORY_LABELS, MARKER_COLOURS, FALLBACK_COLOUR,
} from '../lib/categories.js'
import { draftCarta, submitReport } from '../data/submissions.js'

const ICON = { size: 14, strokeWidth: 1.75 }
const ICONS = { Trash2, Ban, Sofa, ShieldAlert, Gift, MoreHorizontal }

// Haiku 4.5 list price, dollars per million tokens. Shown so the cost of a
// draft is visible where it is incurred rather than discovered on an invoice.
const PRICE_IN = 1.0
const PRICE_OUT = 5.0

function formatCost({ input_tokens, output_tokens }) {
  const usd = (input_tokens / 1e6) * PRICE_IN + (output_tokens / 1e6) * PRICE_OUT
  return `${input_tokens} in / ${output_tokens} out, about $${usd.toFixed(4)}`
}

// The icon grid from v0.2's CategoryGrid, translated. Each tile carries a label
// and a line of helper text, which is what made the v0.2 form quick to fill.
function CategoryGrid({ selected, onSelect }) {
  return (
    <div className="cat-grid">
      {ALL_CATEGORIES.map((key) => {
        const { label, desc, icon } = CATEGORIES[key]
        const Glyph = ICONS[icon] || MoreHorizontal
        return (
          <button
            type="button"
            key={key}
            className={`cat-tile${selected === key ? ' selected' : ''}`}
            onClick={() => onSelect(key)}
            style={selected === key ? { borderColor: MARKER_COLOURS[key] || FALLBACK_COLOUR } : undefined}
          >
            <Glyph
              size={17}
              strokeWidth={ICON.strokeWidth}
              color={selected === key ? MARKER_COLOURS[key] || FALLBACK_COLOUR : 'currentColor'}
            />
            <span className="cat-label">{label}</span>
            <span className="cat-desc">{desc}</span>
          </button>
        )
      })}
    </div>
  )
}

// v0.2 showed the letter in a modal over the panel. Kept, because the letter is
// long and the panel is narrow, and because a letter to a public body deserves
// to be read at full width before it is sent.
function CartaModal({ carta, setCarta, usage, loading, error, onClose }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(carta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard is blocked in some contexts. The text is selectable anyway.
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-eyebrow">Letter to the city council</span>
          <button className="panel-close" onClick={onClose} aria-label="Close">
            <X size={15} strokeWidth={ICON.strokeWidth} />
          </button>
        </div>

        <div className="modal-body">
          {loading && <p className="panel-empty">Drafting the letter…</p>}
          {error && <p className="panel-error">{error}</p>}
          {carta && (
            <textarea
              className="carta-text"
              value={carta}
              onChange={(e) => setCarta(e.target.value)}
              rows={18}
            />
          )}
        </div>

        {carta && (
          <div className="modal-foot">
            <button className="panel-button ghost" onClick={handleCopy}>
              {copied ? (
                <><Check size={ICON.size} strokeWidth={ICON.strokeWidth} /> Copied</>
              ) : (
                <><Copy size={ICON.size} strokeWidth={ICON.strokeWidth} /> Copy</>
              )}
            </button>
            {usage && <span className="panel-usage">{formatCost(usage)}</span>}
          </div>
        )}

        <p className="panel-note modal-note">
          Draft only, written by a language model. Read it and check every street
          name and date against the source before sending anything.
        </p>
      </div>
    </div>
  )
}

// Shared letter state, used by both tabs.
function useCarta() {
  const [open, setOpen] = useState(false)
  const [carta, setCarta] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function generate(payload) {
    setOpen(true)
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

  return { open, setOpen, carta, setCarta, usage, loading, error, generate }
}

function NotifyTab({ record }) {
  const letter = useCarta()

  if (!record) {
    return (
      <p className="panel-empty">
        Select a marker on the map to draft a notification about that record.
      </p>
    )
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

      <p className="panel-note">
        This record is already in the audited dataset. The letter is signed as the
        project, not as a resident.
      </p>

      <button
        className="panel-button"
        disabled={letter.loading}
        onClick={() =>
          letter.generate({
            origen: 'record',
            categoria: record.categoria,
            severidad: record.severidad,
            localizacion: record.localizacion,
            zona: record.zona,
            fecha: record.fecha,
            descripcion: record.descripcion,
          })
        }
      >
        {letter.loading ? (
          <><Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Drafting</>
        ) : (
          <><FileText size={ICON.size} strokeWidth={ICON.strokeWidth} /> Draft letter to the city council</>
        )}
      </button>

      {letter.open && (
        <CartaModal {...letter} setCarta={letter.setCarta} onClose={() => letter.setOpen(false)} />
      )}
    </>
  )
}

function ReportTab() {
  const [categoria, setCategoria] = useState(null)
  const [localizacion, setLocalizacion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [sending, setSending] = useState(false)
  const [sentReport, setSentReport] = useState(null)
  const [error, setError] = useState(null)
  const letter = useCarta()

  const canSubmit = categoria !== null && localizacion.trim().length >= 3 && !sending

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setSending(true)
    setError(null)
    try {
      const report = { categoria, localizacion: localizacion.trim(), descripcion: descripcion.trim() }
      await submitReport(report)
      setSentReport(report)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  function handleReset() {
    setSentReport(null)
    setCategoria(null)
    setLocalizacion('')
    setDescripcion('')
    setError(null)
  }

  // Success screen, following v0.2's shape. One sentence had to change rather
  // than be translated: v0.2 said the report already appears on the public map.
  // Here it does not, and saying so would be false.
  if (sentReport) {
    return (
      <div className="panel-success">
        <span className="success-badge">
          <Check size={20} strokeWidth={2.5} />
        </span>
        <h2 className="success-title">Report received</h2>
        <p className="success-sub">
          Your report on <strong>{sentReport.localizacion}</strong> is in the review
          queue. It does not appear on the map: the map is built from scraped
          sources, and a person checks every submission first.
        </p>

        <div className="summary">
          <div className="summary-row">
            <span className="summary-key">Category</span>
            <span className="summary-val">{CATEGORY_LABELS[sentReport.categoria]}</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Location</span>
            <span className="summary-val">{sentReport.localizacion}</span>
          </div>
        </div>

        <button
          className="panel-button"
          disabled={letter.loading}
          onClick={() => letter.generate({ origen: 'submission', ...sentReport })}
        >
          {letter.loading ? (
            <><Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Drafting</>
          ) : (
            <><FileText size={ICON.size} strokeWidth={ICON.strokeWidth} /> Draft letter to the city council</>
          )}
        </button>

        <button className="panel-button ghost" onClick={handleReset}>
          New report
        </button>

        {letter.open && (
          <CartaModal {...letter} setCarta={letter.setCarta} onClose={() => letter.setOpen(false)} />
        )}
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

      <section className="form-section">
        <span className="section-label">Location</span>
        <input
          type="text"
          value={localizacion}
          onChange={(e) => setLocalizacion(e.target.value)}
          placeholder="Street and number, or a nearby landmark"
          minLength={3}
          maxLength={200}
          required
        />
      </section>

      <section className="form-section">
        <span className="section-label">Category</span>
        <CategoryGrid selected={categoria} onSelect={setCategoria} />
      </section>

      <section className="form-section">
        <span className="section-label">Description</span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Describe the problem (optional)"
        />
      </section>

      {error && <p className="panel-error">{error}</p>}

      <button className="panel-button" type="submit" disabled={!canSubmit}>
        {sending ? (
          <><Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Sending</>
        ) : (
          <><Send size={ICON.size} strokeWidth={ICON.strokeWidth} /> Submit report</>
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
          <button className={tab === 'notify' ? 'active' : ''} onClick={() => onTab('notify')}>
            Notify
          </button>
          <button className={tab === 'report' ? 'active' : ''} onClick={() => onTab('report')}>
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
