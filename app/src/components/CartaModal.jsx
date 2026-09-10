import { useState } from 'react'
import { X, Copy, Check, FileText } from 'lucide-react'

const ICON = { size: 14, strokeWidth: 1.75 }

// Haiku 4.5 list price, dollars per million tokens. Shown so the cost of a
// draft is visible where it is incurred rather than discovered on an invoice.
const PRICE_IN = 1.0
const PRICE_OUT = 5.0

function formatCost({ input_tokens, output_tokens }) {
  const usd = (input_tokens / 1e6) * PRICE_IN + (output_tokens / 1e6) * PRICE_OUT
  return `${input_tokens} ent. / ${output_tokens} sal., unos ${usd.toFixed(4)} USD`
}

export default function CartaModal({ stage, carta, setCarta, usage, loading, error, onGenerate, onClose, intro }) {
  const [copied, setCopied] = useState(false)

  if (!stage) return null

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
          <span className="modal-eyebrow">
            {stage === 'ask' ? 'Notificar al Ayuntamiento' : 'Carta al Ayuntamiento'}
          </span>
          <button className="panel-close" onClick={onClose} aria-label="Cerrar">
            <X size={15} strokeWidth={ICON.strokeWidth} />
          </button>
        </div>

        {stage === 'ask' ? (
          <>
            <div className="modal-body">
              <p className="ask-title">¿Quieres notificar al Ayuntamiento?</p>
              <p className="panel-note">
                {intro ||
                  'Se redactará una carta formal en español a partir de estos datos. Podrás leerla, editarla y copiarla antes de enviarla tú mismo. Recolle no la envía por ti.'}
              </p>
            </div>
            <div className="modal-foot ask-foot">
              <button className="panel-button" onClick={onGenerate}>
                <FileText size={ICON.size} strokeWidth={ICON.strokeWidth} />
                Sí, generar la carta
              </button>
              <button className="panel-button ghost" onClick={onClose}>
                Ahora no
              </button>
            </div>
          </>
        ) : (
          <>
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
              cada calle y cada fecha contra el origen antes de mandar nada.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
