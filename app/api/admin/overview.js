import { guard, db, methodNotAllowed } from '../_admin.js'

// Dashboard numbers plus the alerts worth acting on. The alerts are not
// decoration: each one is a condition that has already caused a problem in this
// project, or that would break a promise the interface makes.
export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET'])
  if (guard(req, res)) return

  try {
    const count = async (path) => {
      const { headers } = await db(path, { prefer: 'count=exact' })
      // Content-Range comes back as "0-24/90" or "*/0".
      return Number(headers.get('content-range')?.split('/')[1] ?? 0)
    }

    const [
      records, sinZona, sinCoordenada, delConcello,
      pendientes, aceptadas, rechazadas,
    ] = await Promise.all([
      count('records?select=id'),
      count('records?select=id&zona=is.null'),
      count('records?select=id&lat=is.null'),
      count('records?select=id&fuente_tipo=eq.concello'),
      count('submissions?select=id&estado=eq.pending'),
      count('submissions?select=id&estado=eq.accepted'),
      count('submissions?select=id&estado=eq.rejected'),
    ])

    const { data: ultimo } = await db('records?select=fecha&order=fecha.desc&limit=1')
    const ultimaFecha = ultimo?.[0]?.fecha ?? null
    const diasSinDatos = ultimaFecha
      ? Math.floor((Date.now() - new Date(ultimaFecha).getTime()) / 86400000)
      : null

    const { data: reciente } = await db(
      'submissions?select=created_at&estado=eq.pending&order=created_at.asc&limit=1',
    )
    const esperaMasAntigua = reciente?.[0]?.created_at
      ? Math.floor((Date.now() - new Date(reciente[0].created_at).getTime()) / 3600000)
      : null

    const alerts = []

    if (pendientes > 0) {
      alerts.push({
        level: esperaMasAntigua != null && esperaMasAntigua > 72 ? 'error' : 'warn',
        title: `${pendientes} aviso${pendientes === 1 ? '' : 's'} sin revisar`,
        detail:
          esperaMasAntigua != null
            ? `El más antiguo lleva ${esperaMasAntigua} h esperando. La interfaz promete a quien lo envía que una persona lo comprueba.`
            : 'La interfaz promete a quien lo envía que una persona lo comprueba.',
      })
    }

    if (records > 0 && sinZona / records > 0.5) {
      alerts.push({
        level: 'warn',
        title: `${sinZona} de ${records} registros sin zona confirmada`,
        detail:
          'Las tres consultas del punto 4.7, conteo por zona, tiempo desde el último registro por zona y punto caliente por barrio, no se pueden responder mientras la mayoría sea nula.',
      })
    }

    if (sinCoordenada > 0) {
      alerts.push({
        level: 'info',
        title: `${sinCoordenada} registros sin coordenada`,
        detail: 'No aparecen en el mapa. Su campo reason explica por qué falló la geocodificación.',
      })
    }

    if (diasSinDatos != null && diasSinDatos > 7) {
      alerts.push({
        level: 'warn',
        title: `Sin datos nuevos desde hace ${diasSinDatos} días`,
        detail: `El registro más reciente es del ${ultimaFecha}. Puede tocar una captura de Apify.`,
      })
    }

    // Supabase pauses a Free Plan project after a stretch without activity, and
    // when it pauses the public map loads its shell and shows nothing, because
    // every record comes from the database.
    alerts.push({
      level: 'info',
      title: 'Plan gratuito de Supabase',
      detail:
        'Un proyecto gratuito se pausa por inactividad. Si se pausa, el mapa público carga pero sale vacío. Abrir el panel de Supabase de vez en cuando lo mantiene despierto.',
    })

    res.status(200).json({
      stats: {
        records, sinZona, sinCoordenada, delConcello,
        pendientes, aceptadas, rechazadas,
        ultimaFecha, diasSinDatos,
      },
      alerts,
    })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message })
  }
}
