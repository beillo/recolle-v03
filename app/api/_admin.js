// Shared plumbing for the /api/admin/* functions.
//
// Everything here runs server side only. The service role key bypasses row
// level security, which is exactly why it must never be sent to a browser:
// it can read the submission queue, promote rows into records, and delete
// anything. It lives in a Vercel environment variable and leaves this process
// only as a request to Supabase.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_TOKEN = process.env.ADMIN_TOKEN

// Constant time comparison. A plain === leaks the length of the correct token
// through timing, which is cheap to avoid.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Returns null when the request may proceed, or a body to send back.
export function guard(req, res) {
  if (!ADMIN_TOKEN) {
    res.status(503).json({
      error: 'ADMIN_TOKEN no está configurado en este despliegue.',
      missing: 'ADMIN_TOKEN',
    })
    return true
  }

  // The caller is authenticated before anything else is reported. Answering
  // "which environment variable is missing" to an unauthenticated request
  // hands out a map of the deployment's configuration for free.
  const sent = req.headers['x-admin-token']
  if (!safeEqual(String(sent || ''), ADMIN_TOKEN)) {
    res.status(401).json({ error: 'Token de administración incorrecto.' })
    return true
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(503).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY no está configurado en este despliegue.',
      missing: 'SUPABASE_SERVICE_ROLE_KEY',
    })
    return true
  }
  return false
}

// Thin PostgREST client. The Supabase JS SDK is a browser dependency here and
// pulling it into the function bundle buys nothing: these are four REST calls.
export async function db(path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
  if (prefer) headers.Prefer = prefer

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw Object.assign(new Error(data?.message || `Supabase respondió ${res.status}`), {
      status: res.status,
    })
  }
  return { data, headers: res.headers }
}

export function methodNotAllowed(req, res, allowed) {
  res.setHeader('Allow', allowed.join(', '))
  res.status(405).json({ error: `Método ${req.method} no permitido.` })
}
