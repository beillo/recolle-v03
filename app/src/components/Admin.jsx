import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, Info, XCircle, RefreshCw, Check, X, ArrowUpRight,
  Download, LogOut, Loader,
} from 'lucide-react'

import { CATEGORY_LABELS } from '../lib/categories.js'

const ICON = { size: 14, strokeWidth: 1.75 }
const TOKEN_KEY = 'recolle.admin.token'

// The token is kept in sessionStorage, not localStorage: it dies with the tab.
// It is a shared password checked server side, not a user account, so the less
// it lingers the better.
function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

async function api(path, token, options = {}) {
  const res = await fetch(`/api/admin/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status, missing: data.missing })
  return data
}

const LEVEL_ICON = { error: XCircle, warn: AlertTriangle, info: Info }

function Alerts({ alerts }) {
  if (!alerts?.length) return null
  return (
    <div className="admin-alerts">
      {alerts.map((a, i) => {
        const Glyph = LEVEL_ICON[a.level] || Info
        return (
          <div key={i} className={`admin-alert ${a.level}`}>
            <Glyph size={16} strokeWidth={ICON.strokeWidth} />
            <div>
              <strong>{a.title}</strong>
              <p>{a.detail}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Stats({ stats }) {
  const cells = [
    ['Registros', stats.records],
    ['Sin zona', stats.sinZona],
    ['Sin coordenada', stats.sinCoordenada],
    ['Del Concello', stats.delConcello],
    ['Avisos pendientes', stats.pendientes],
    ['Aceptados', stats.aceptadas],
    ['Rechazados', stats.rechazadas],
    ['Último registro', stats.ultimaFecha ?? 'sin datos'],
  ]
  return (
    <div className="admin-stats">
      {cells.map(([label, value]) => (
        <div key={label} className="admin-stat">
          <span className="admin-stat-value">{value}</span>
          <span className="admin-stat-label">{label}</span>
        </div>
      ))}
    </div>
  )
}

function Queue({ token, onChanged }) {
  const [estado, setEstado] = useState('pending')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api(`queue?estado=${estado}`, token)
      setRows(data.rows)
      setError(null)
    } catch (err) {
      setError(err.message)
      setRows([])
    }
  }, [estado, token])

  useEffect(() => {
    let live = true
    Promise.resolve().then(() => {
      if (live) load()
    })
    return () => {
      live = false
    }
  }, [load])

  async function act(id, action) {
    setBusy(id)
    setError(null)
    try {
      const data = await api('queue', token, {
        method: 'POST',
        body: JSON.stringify({ id, action }),
      })
      if (data.promoted_to) {
        setError(`Promovido al registro ${data.promoted_to}.`)
      }
      await load()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Cola de revisión</h2>
        <div className="admin-filters">
          {['pending', 'accepted', 'rejected'].map((e) => (
            <button
              key={e}
              className={estado === e ? 'active' : ''}
              onClick={() => setEstado(e)}
            >
              {{ pending: 'Pendientes', accepted: 'Aceptados', rejected: 'Rechazados' }[e]}
            </button>
          ))}
          <button onClick={load} title="Recargar">
            <RefreshCw size={ICON.size} strokeWidth={ICON.strokeWidth} />
          </button>
        </div>
      </div>

      {error && <p className="panel-error">{error}</p>}
      {rows === null && <p className="panel-empty">Cargando…</p>}
      {rows?.length === 0 && <p className="panel-empty">No hay avisos en este estado.</p>}

      <div className="admin-rows">
        {rows?.map((row) => (
          <article key={row.id} className="admin-row">
            {row.photoUrl && <img src={row.photoUrl} alt="" className="admin-row-photo" />}
            <div className="admin-row-main">
              <span className="admin-row-cat">{CATEGORY_LABELS[row.categoria] || row.categoria}</span>
              <span className="admin-row-loc">{row.localizacion}</span>
              {row.descripcion && <p className="admin-row-desc">{row.descripcion}</p>}
              <span className="admin-row-meta">
                {new Date(row.created_at).toLocaleString('es-ES')}
                {row.lat != null ? ` · ${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}` : ' · sin coordenada'}
                {row.promoted_to && ` · registro ${row.promoted_to}`}
              </span>
            </div>
            {estado === 'pending' && (
              <div className="admin-row-actions">
                <button
                  className="panel-button"
                  disabled={busy === row.id}
                  onClick={() => act(row.id, 'promote')}
                  title="Crear un registro en el mapa a partir de este aviso"
                >
                  <ArrowUpRight size={ICON.size} strokeWidth={ICON.strokeWidth} /> Promover
                </button>
                <button className="panel-button ghost" disabled={busy === row.id} onClick={() => act(row.id, 'accept')}>
                  <Check size={ICON.size} strokeWidth={ICON.strokeWidth} /> Aceptar
                </button>
                <button className="panel-button ghost" disabled={busy === row.id} onClick={() => act(row.id, 'reject')}>
                  <X size={ICON.size} strokeWidth={ICON.strokeWidth} /> Rechazar
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function Apify({ token }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    setError(null)
    setState(null)
    try {
      setState(await api('apify', token, { method: 'POST' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h2>Captura de Apify</h2>
      </div>
      <p className="panel-note">
        Consulta la última ejecución correcta del actor y dice cuántos posts trae,
        sin importar nada. La importación sigue siendo local, porque es ahí donde
        se quitan los datos personales y se descargan las imágenes.
      </p>
      <button className="panel-button" onClick={run} disabled={loading}>
        {loading ? (
          <><Loader size={ICON.size} strokeWidth={ICON.strokeWidth} className="spin" /> Consultando</>
        ) : (
          <><Download size={ICON.size} strokeWidth={ICON.strokeWidth} /> Consultar última captura</>
        )}
      </button>

      {error && <p className="panel-error">{error}</p>}

      {state && (
        <div className="admin-apify">
          <div className="admin-stats">
            <div className="admin-stat">
              <span className="admin-stat-value">{state.total}</span>
              <span className="admin-stat-label">Posts</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">{state.urlsUnicas}</span>
              <span className="admin-stat-label">URLs únicas</span>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-value">
                {state.run.finishedAt ? new Date(state.run.finishedAt).toLocaleDateString('es-ES') : '?'}
              </span>
              <span className="admin-stat-label">Ejecutado</span>
            </div>
          </div>
          <ul className="admin-sample">
            {state.muestra.map((m, i) => (
              <li key={i}>
                <span className="admin-row-desc">{m.texto || 'sin texto'}</span>
                <span className="admin-row-meta">{m.fecha}</span>
              </li>
            ))}
          </ul>
          <p className="panel-note">{state.siguiente}</p>
        </div>
      )}
    </section>
  )
}

export default function Admin() {
  const [token, setToken] = useState(readToken)
  const [input, setInput] = useState('')
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState(null)

  const loadOverview = useCallback(async () => {
    if (!token) return
    try {
      setOverview(await api('overview', token))
      setError(null)
    } catch (err) {
      setError(err.message)
      if (err.status === 401) {
        setToken('')
        try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
      }
    }
  }, [token])

  useEffect(() => {
    let live = true
    Promise.resolve().then(() => {
      if (live) loadOverview()
    })
    return () => {
      live = false
    }
  }, [loadOverview])

  function signIn(event) {
    event.preventDefault()
    try { sessionStorage.setItem(TOKEN_KEY, input) } catch { /* ignore */ }
    setToken(input)
    setInput('')
  }

  if (!token) {
    return (
      <div className="admin-login">
        <form onSubmit={signIn}>
          <h1 className="wordmark">Recolle<span className="dot">.</span></h1>
          <p className="panel-note">Panel de administración</p>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Token de administración"
            autoFocus
          />
          <button className="panel-button" type="submit" disabled={!input}>Entrar</button>
          {error && <p className="panel-error">{error}</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="admin">
      <header className="header">
        <h1 className="wordmark">Recolle<span className="dot">.</span></h1>
        <span className="admin-badge">Administración</span>
        <div className="counts">
          <a className="admin-link" href="/">Ver el mapa</a>
          <button
            className="admin-link"
            onClick={() => {
              try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
              setToken('')
            }}
          >
            <LogOut size={ICON.size} strokeWidth={ICON.strokeWidth} /> Salir
          </button>
        </div>
      </header>

      <div className="admin-body">
        {error && <p className="panel-error">{error}</p>}
        {overview && (
          <>
            <Alerts alerts={overview.alerts} />
            <section className="admin-section">
              <div className="admin-section-head">
                <h2>Estado</h2>
                <div className="admin-filters">
                  <button onClick={loadOverview} title="Recargar">
                    <RefreshCw size={ICON.size} strokeWidth={ICON.strokeWidth} />
                  </button>
                </div>
              </div>
              <Stats stats={overview.stats} />
            </section>
          </>
        )}
        <Queue token={token} onChanged={loadOverview} />
        <Apify token={token} />
      </div>
    </div>
  )
}
