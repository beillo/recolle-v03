import { useRef, useState } from 'react'
import {
  X, Copy, Check, Send, FileText, Loader, ImagePlus, Trash,
  Trash2, Ban, Sofa, ShieldAlert, Gift, MoreHorizontal,
} from 'lucide-react'

import {
  ALL_CATEGORIES, CATEGORIES, CATEGORY_LABELS, MARKER_COLOURS, FALLBACK_COLOUR,
} from '../lib/categories.js'
import {
  draftCarta, submitReport, ACCEPTED_PHOTO_TYPES, MAX_PHOTO_BYTES,
} from '../data/submissions.js'

const ICON = { size: 14, strokeWidth: 1.75 }
const ICONS = { Trash2, Ban, Sofa, ShieldAlert, Gift, MoreHorizontal }

// Haiku 4.5 list price, dollars per million tokens. Shown so the cost of a
// draft is visible where it is incurred rather than discovered on an invoice.
const PRICE_IN = 1.0
const PRICE_OUT = 5.0

function formatCost({ input_tokens, output_tokens }) {
  const usd = (input_tokens / 1e6) * PRICE_IN + (output_tokens / 1e6) * PRICE_OUT
  return `${input_tokens} ent. / ${output_tokens} sal., unos ${usd.toFixed(4)} USD`
}

// The icon grid from v0.2's CategoryGrid.
function CategoryGrid({ selected, onSelect }) {
  return (
    <div className="cat-grid">
      {ALL_CATEGORIES.map((key) => {
        const { label, desc, icon } = CATEGORIES[key]
        const Glyph = ICONS[icon] || MoreHorizontal
        const colour = MARKER_COLOURS[key] || FALLBACK_COLOUR
        return (
          <button
            type="button"
            key={key}
            className={`cat-tile${selected === key ? ' selected' : ''}`}
            onClick={() => onSelect(key)}
            style={selected === key ? { borderColor: colour } : undefined}
          >
            <Glyph
              size={17}
              strokeWidth={ICON.strokeWidth}
              color={selected === key ? colour : 'currentColor'}
            />
            <span className="cat-label">{label}</span>
            <span className="cat-desc">{desc}</span>
          </button>
        )
      })}
    </div>
  )
}

// Carried over from v0.2's PhotoUpload. The preview is a local object URL, the
// file only leaves the browser when the form is submitted.
function PhotoUpload({ file, onSelect, onRemove }) {
  const inputRef = useRef(null)
  const [problem, setProblem] = useState(null)

  function handleChange(event) {
    const picked = event.target.files?.[0]
    if (!picked) return
    if (picked.size > MAX_PHOTO_BYTES) {
      setProblem('La foto supera los 4 MB.')
      return
    }
    if (!ACCEPTED_PHOTO_TYPES.includes(picked.type)) {
      setProblem('Formato no admitido. Usa JPG, PNG, WEBP o HEIC.')
      return
    }
    setProblem(null)
    onSelect(picked)
  }

  if (file) {
    return (
      <div className="photo-picked">
        <img src={URL.createObjectURL(file)} alt="Vista previa" />
        <div className="photo-meta">
          <span className="photo-name">{file.name}</span>
          <span className="photo-size">{(file.size / 1024).toFixed(0)} KB</span>
        </div>
        <button type="button" className="photo-remove" onClick={onRemove} aria-label="Quitar foto">
          <Trash size={ICON.size} strokeWidth={ICON.strokeWidth} />
        </button>
      </div>
    )
  }

  return (
    <>
      <button type="button" className="photo-drop" onClick={() => inputRef.current?.click()}>
        <ImagePlus size={18} strokeWidth={ICON.strokeWidth} />
        <span>Añadir una foto</span>
        <span className="photo-hint">JPG, PNG, WEBP o HEIC, hasta 4 MB</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_PHOTO_TYPES.join(',')}
        onChange={handleChange}
        hidden
      />
      {problem && <p className="panel-error">{problem}</p>}
    </>
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
      // Clipboard is blocked in some contexts. The text stays selectable.
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-eyebrow">Carta al Ayuntamiento</span>
          <button className="panel-close" onClick={onClose} aria-label="Cerrar">
            <X size={15} strokeWidth={ICON.strokeWidth} />
          </button>
        </div>

        <div className="modal-body">
          {loading && <p className="panel-empty">Redactando la carta…</p>}
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
                <><Check size={ICON.size} strokeWidth={ICON.strokeWidth} /> Copiada</>
              ) : (
                <><Copy size={ICON.size} strokeWidth={ICON.strokeWidth} /> Copiar</>
              )}
            </button>
            {usage && <span className="panel-usage">{formatCost(usage)}</span>}
          </div>
        )}

        <p className="panel-note modal-note">
          Es un borrador, redactado por un modelo de lenguaje. Léelo y comprueba
          cada calle y cada fecha contra el origen antes de enviar nada.
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
        Selecciona un marcador en el mapa para redactar una notificación sobre ese
        registro.
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
        <span className="panel-record-id">Registro {record.id}</span>
        <p className="panel-record-loc">
          {record.localizacion}
          {record.zona && ` · ${record.zona}`}
        </p>
        {record.fecha && <p className="panel-record-date">{record.fecha}</p>}
      </div>

      <p className="panel-note">
        Este registro ya está en el conjunto de datos verificado. La carta se firma
        como el proyecto, no como un vecino.
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
          <><Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Redactando</>
        ) : (
          <><FileText size={ICON.size} strokeWidth={ICON.strokeWidth} /> Generar carta al Ayuntamiento</>
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
  const [photoFile, setPhotoFile] = useState(null)
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
      const report = {
        categoria,
        localizacion: localizacion.trim(),
        descripcion: descripcion.trim(),
      }
      await submitReport({ ...report, photoFile })
      setSentReport({ ...report, conFoto: Boolean(photoFile) })
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
    setPhotoFile(null)
    setError(null)
  }

  // Success screen, following v0.2's shape. One sentence had to change rather
  // than be translated: v0.2 said the report already appeared on the public map.
  // Here it does not, and saying so would be false.
  if (sentReport) {
    return (
      <div className="panel-success">
        <span className="success-badge">
          <Check size={20} strokeWidth={2.5} />
        </span>
        <h2 className="success-title">Incidencia recibida</h2>
        <p className="success-sub">
          Tu aviso en <strong>{sentReport.localizacion}</strong> está en la cola de
          revisión. No aparece en el mapa: el mapa se construye a partir de fuentes
          rastreadas, y una persona comprueba cada aviso antes de nada.
        </p>

        <div className="summary">
          <div className="summary-row">
            <span className="summary-key">Categoría</span>
            <span className="summary-val">{CATEGORY_LABELS[sentReport.categoria]}</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Ubicación</span>
            <span className="summary-val">{sentReport.localizacion}</span>
          </div>
          <div className="summary-row">
            <span className="summary-key">Foto</span>
            <span className="summary-val">{sentReport.conFoto ? 'Adjunta' : 'Sin foto'}</span>
          </div>
        </div>

        <button
          className="panel-button"
          disabled={letter.loading}
          onClick={() =>
            letter.generate({
              origen: 'submission',
              categoria: sentReport.categoria,
              localizacion: sentReport.localizacion,
              descripcion: sentReport.descripcion,
            })
          }
        >
          {letter.loading ? (
            <><Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Redactando</>
          ) : (
            <><FileText size={ICON.size} strokeWidth={ICON.strokeWidth} /> Generar carta al Ayuntamiento</>
          )}
        </button>

        <button className="panel-button ghost" onClick={handleReset}>
          Nueva incidencia
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
        Esto no añade un punto al mapa. El conjunto de datos se construye solo a
        partir de fuentes rastreadas, así que tu aviso espera en una cola de
        revisión hasta que una persona lo compruebe.
      </p>

      <section className="form-section">
        <span className="section-label">Ubicación</span>
        <input
          type="text"
          value={localizacion}
          onChange={(e) => setLocalizacion(e.target.value)}
          placeholder="Calle y número, o una referencia cercana"
          minLength={3}
          maxLength={200}
          required
        />
      </section>

      <section className="form-section">
        <span className="section-label">Categoría</span>
        <CategoryGrid selected={categoria} onSelect={setCategoria} />
      </section>

      <section className="form-section">
        <span className="section-label">Descripción</span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Describe el problema (opcional)"
        />
      </section>

      <section className="form-section">
        <span className="section-label">Foto (opcional)</span>
        <PhotoUpload
          file={photoFile}
          onSelect={setPhotoFile}
          onRemove={() => setPhotoFile(null)}
        />
      </section>

      {error && <p className="panel-error">{error}</p>}

      <button className="panel-button" type="submit" disabled={!canSubmit}>
        {sending ? (
          <><Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Enviando</>
        ) : (
          <><Send size={ICON.size} strokeWidth={ICON.strokeWidth} /> Enviar incidencia</>
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
            Notificar
          </button>
          <button className={tab === 'report' ? 'active' : ''} onClick={() => onTab('report')}>
            Reportar
          </button>
        </div>
        <button className="panel-close" onClick={onClose} aria-label="Cerrar panel">
          <X size={16} strokeWidth={ICON.strokeWidth} />
        </button>
      </header>

      <div className="panel-body">
        {tab === 'notify' ? <NotifyTab record={record} /> : <ReportTab />}
      </div>
    </aside>
  )
}
