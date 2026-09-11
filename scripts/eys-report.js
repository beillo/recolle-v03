// Aggregates the extracted newsletter issues into something readable. No LLM
// and no judgement here: this script only counts, so that the judgement made
// later, with a human, rests on numbers rather than on an impression formed
// while skimming.
//
// Usage:
//   node scripts/eys-report.js          dossier for the latest issue, to triage
//   node scripts/eys-report.js --all    terrain map over the whole archive
//
// The terrain map is the point of the backfill. A single week cannot tell you
// whether a niche exists; 359 issues over seven years can, because a niche shows
// up as a theme that keeps coming back, and a dead end shows up as a spike that
// never repeats.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const EYS_DIR = join(ROOT, 'data', 'eys')
const ISSUES_DIR = join(EYS_DIR, 'issues')

// The vocabulary that decides what gets counted, and therefore the one thing in
// this script that encodes an opinion. Kept here, in the open, so it can be
// argued with and edited. Patterns run against accent-stripped lowercase text,
// which is why they carry no accents.
const TEMAS = {
  'contrato / licitación': /\b(contrat\w+|licitaci\w+|adjudic\w+|pliego|concurso publico|ute|concesi\w+)\b/,
  'recogida de residuos': /\b(recogida|residuo\w*|basura\w*|rsu|vertido\w*|limpieza viaria)\b/,
  'biorresiduo / orgánica': /\b(biorresiduo\w*|organic\w+|compostaj\w+|quinto contenedor|marron)\b/,
  'impropios / calidad': /\b(impropio\w*|calidad del residuo|caracterizaci\w+)\b/,
  'Ley 7/2022 / normativa': /\b(ley 7\/2022|normativ\w+|directiva|reglament\w+|obligaci\w+ legal|sancion\w*)\b/,
  'tasa / pago por generación': /\b(tasa de basura\w*|pago por generacion|payt|tarifa\w*|fiscalidad)\b/,
  'sensores / IoT / telemetría': /\b(sensor\w*|iot|telemetri\w+|rfid|identificaci\w+ de usuario|volumetr\w+)\b/,
  'datos / plataforma / IA': /\b(dato\w*|plataforma digital|cuadro de mando|inteligencia artificial|algoritmo\w*|gemelo digital)\b/,
  'contenedores / equipamiento': /\b(contenedor\w*|isla\w* ecologic\w*|soterrad\w*|camion\w*|barredora\w*)\b/,
  'economía circular': /\b(economia circular|reciclaj\w+|reutilizaci\w+|valorizaci\w+)\b/,
  'alumbrado': /\b(alumbrad\w*|luminari\w*|iluminaci\w+|led)\b/,
  'zonas verdes / arbolado': /\b(zona\w* verde\w*|arbolad\w*|parque\w*|jardin\w*|renaturaliz\w+)\b/,
  'agua / saneamiento': /\b(agua\w*|saneamient\w*|alcantarill\w+|depurad\w+|riego)\b/,
  'movilidad': /\b(movilidad|trafico|aparcamient\w*|carril bici|zbe|zona de bajas emisiones)\b/,
  'plagas / limpieza': /\b(plaga\w*|desinfecci\w+|desratizaci\w+|grafiti\w*)\b/,
}

// Galicia gets its own count because recolle is in A Coruña: under a broad
// scope this is the one slice that stays close to home no matter the theme.
const GALICIA = /\b(galicia|galego|gallego|coruna|vigo|ourense|santiago de compostela|lugo|pontevedra|ferrol|xunta|sogama)\b/

// Title openers that say nothing about who or where. Everything else that
// starts a headline is treated as an actor, which catches municipalities and
// companies alike without needing a gazetteer.
const VACIAS = new Set(
  ('el la los las un una unos unas lo al del de en y o con sin por para sobre entre desde hasta ' +
    'nuevo nueva nuevos nuevas mas como que cual cuando donde este esta estos estas ese esa su sus ' +
    'se ya asi tras ante bajo cada todo toda todos todas gran grandes primer primera ultimo ultima ' +
    'cerca casi solo tambien aun asi no si mientras durante segun ademas ' +
    // "Luz verde a..." is the idiom for an approval, and "Lee ya la edición
    // digital" is the magazine advertising itself, 25 times over seven years.
    'luz lee leer descarga suscribete').split(' '),
)

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

async function loadIssues() {
  const files = (await readdir(ISSUES_DIR)).filter((f) => f.endsWith('.json')).sort()
  const issues = []
  for (const f of files) {
    issues.push(JSON.parse(await readFile(join(ISSUES_DIR, f), 'utf8')))
  }
  return issues
}

// Everything the counters look at, computed once per item.
//
// Deduplicated by URL and not by title: the newsletter re-runs a highlight in a
// later issue, and counting it twice inflates every total here. The first
// appearance wins, so an item is dated to the week it actually broke.
function prepare(issues) {
  const items = []
  const vistos = new Set()
  let repetidos = 0
  for (const issue of issues) {
    for (const it of issue.items) {
      if (vistos.has(it.url)) {
        repetidos++
        continue
      }
      vistos.add(it.url)
      items.push({
        ...it,
        edicion: issue.edicion,
        anio: issue.edicion.slice(0, 4),
        plantilla: issue.plantilla,
        texto: norm(`${it.titulo} ${it.resumen}`),
      })
    }
  }
  items.repetidos = repetidos
  return items
}

function tally(pairs) {
  const m = new Map()
  for (const [k, n = 1] of pairs) m.set(k, (m.get(k) ?? 0) + n)
  return m
}

const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

const limpia = (palabra = '') => palabra.replace(/[^\p{L}\s.'-]/gu, '')

function actor(titulo) {
  const palabras = titulo.replace(/^[^\p{L}]+/u, '').split(/\s+/).filter(Boolean)
  const primera = limpia(palabras[0])
  if (!primera || !/^[\p{Lu}]/u.test(primera)) return null

  // An article opener names nobody: "El Ayuntamiento", "La recogida", "Luz
  // verde a...". Dropped before the two word rule, or every one of them would
  // come back paired with whatever generic noun follows.
  if (VACIAS.has(norm(primera))) return null

  // "A Coruña", "L'Hospitalet": a one or two letter opener needs the next word.
  const segunda = limpia(palabras[1])
  if (primera.length <= 2 && segunda) return `${primera} ${segunda}`
  return primera
}

// A markdown table from a Map of row -> Map of column -> count.
function crossTable(rows, cols, get, rowLabel) {
  const head = `| ${rowLabel} | ${cols.join(' | ')} | total |`
  const sep = `| --- | ${cols.map(() => '---:').join(' | ')} | ---: |`
  const body = rows.map((r) => {
    const vals = cols.map((c) => get(r, c))
    const total = vals.reduce((a, b) => a + b, 0)
    return `| ${r} | ${vals.map((v) => v || '·').join(' | ')} | **${total}** |`
  })
  return [head, sep, ...body].join('\n')
}

async function terrainMap(issues) {
  const items = prepare(issues)
  const anios = [...new Set(items.map((i) => i.anio))].sort()
  const out = []

  out.push('# Mapa de terreno — EySMunicipales')
  out.push('')
  out.push(
    `${issues.length} ediciones, ${items.length} noticias únicas ` +
      `(${items.repetidos} repeticiones entre ediciones, descontadas), ` +
      `de ${issues[0].edicion} a ${issues[issues.length - 1].edicion}. ` +
      `Generado por \`scripts/eys-report.js --all\`, sin LLM.`,
  )
  out.push('')
  const porPlantilla = tally(issues.map((i) => [i.plantilla]))
  out.push(
    'Plantillas: ' +
      sorted(porPlantilla)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') +
      '. La plantilla B no publica categoría, por eso la tabla de categorías empieza en 2022.',
  )

  // Categories, the publication's own taxonomy. Template A only.
  out.push('')
  out.push('## Categorías por año')
  out.push('')
  const conCat = items.filter((i) => i.categoria)
  const cats = [...new Set(conCat.map((i) => i.categoria))].sort()
  const catAnios = [...new Set(conCat.map((i) => i.anio))].sort()
  const catCount = tally(conCat.map((i) => [`${i.categoria}|${i.anio}`]))
  out.push(crossTable(cats, catAnios, (c, a) => catCount.get(`${c}|${a}`) ?? 0, 'categoría'))

  // Themes, recolle's taxonomy rather than the magazine's.
  out.push('')
  out.push('## Temas por año')
  out.push('')
  out.push('Recuento por palabra clave sobre titular y entradilla. Un item puede contar en varios temas.')
  out.push('')
  const temaCount = tally(
    items.flatMap((i) =>
      Object.entries(TEMAS)
        .filter(([, re]) => re.test(i.texto))
        .map(([t]) => [`${t}|${i.anio}`]),
    ),
  )
  out.push(
    crossTable(Object.keys(TEMAS), anios, (t, a) => temaCount.get(`${t}|${a}`) ?? 0, 'tema'),
  )

  // Galicia, the home slice.
  out.push('')
  out.push('## Galicia')
  out.push('')
  const gal = items.filter((i) => GALICIA.test(i.texto))
  const galAnio = tally(gal.map((i) => [i.anio]))
  out.push(
    `${gal.length} noticias mencionan Galicia (${(100 * gal.length / items.length).toFixed(1)}% del total): ` +
      anios.map((a) => `${a} ${galAnio.get(a) ?? 0}`).join(', '),
  )
  out.push('')
  out.push('Las 15 más recientes:')
  out.push('')
  for (const i of gal.slice(-15).reverse()) {
    out.push(`- ${i.edicion} · ${i.categoria || 's/cat'} · [${i.titulo}](${i.url})`)
  }

  // Actors, taken from the first word of each headline.
  out.push('')
  out.push('## Actores más frecuentes')
  out.push('')
  out.push('Primera palabra del titular: municipios y empresas, sin gazetteer.')
  out.push('')
  const actores = sorted(tally(items.map((i) => [actor(i.titulo)]).filter(([a]) => a)))
  out.push(actores.slice(0, 40).map(([a, n]) => `${a} ${n}`).join(' · '))

  // Advertisers over time, and the overlap with editorial coverage.
  out.push('')
  out.push('## Anunciantes')
  out.push('')
  const primera = new Map()
  const ultima = new Map()
  const vecesAnun = tally(issues.flatMap((i) => i.anunciantes.map((a) => [a])))
  for (const issue of issues) {
    for (const a of issue.anunciantes) {
      if (!primera.has(a)) primera.set(a, issue.edicion)
      ultima.set(a, issue.edicion)
    }
  }
  const ultimaEdicion = issues[issues.length - 1].edicion
  const activos = [...ultima.entries()].filter(([, f]) => f === ultimaEdicion).map(([a]) => a)
  out.push(`${vecesAnun.size} anunciantes distintos en total, ${activos.length} en la última edición.`)
  out.push('')
  out.push('| anunciante | ediciones | primera | última | menciones editoriales |')
  out.push('| --- | ---: | --- | --- | ---: |')
  for (const [a, n] of sorted(vecesAnun).slice(0, 30)) {
    // Word boundaries, not a substring test. "ida" is a real advertiser and a
    // fragment of recogida, medida and salida, and matching loosely scored it
    // above two thousand editorial mentions it never had.
    const nombre = norm(a.replace(/-/g, ' ')).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${nombre}\\b`)
    const menciones = items.filter((i) => re.test(i.texto)).length
    out.push(`| ${a} | ${n} | ${primera.get(a)} | ${ultima.get(a)} | ${menciones} |`)
  }

  return out.join('\n') + '\n'
}

async function weeklyDossier(issues) {
  const issue = issues[issues.length - 1]
  const anterior = issues[issues.length - 2]
  // The ledger is written by the /eys skill and is the reason dedup does not
  // depend on querying Notion, which is rate limited on this workspace's plan.
  // Shape: { revisado_hasta, insights: [...], fuentes: { url: notionPageId } }.
  const ledger = await readFile(join(EYS_DIR, 'ledger.json'), 'utf8')
    .then((t) => JSON.parse(t))
    .catch(() => ({}))
  const fuentes = ledger.fuentes ?? {}
  const insights = ledger.insights ?? []

  const out = []
  out.push(`# Dossier — edición ${issue.edicion}`)
  out.push('')
  out.push(`${issue.items.length} noticias. Fuente: ${issue.url}`)
  out.push('')

  issue.items.forEach((it, n) => {
    const visto = fuentes[it.url] ? '  ← ya citado en la base' : ''
    out.push(`### ${n + 1}. ${it.titulo}${visto}`)
    out.push(`*${it.categoria || 'sin categoría'}* · ${it.url}`)
    out.push('')
    out.push(it.resumen || '(sin entradilla)')
    out.push('')
  })

  if (anterior) {
    const antes = new Set(anterior.anunciantes)
    const ahora = new Set(issue.anunciantes)
    const nuevos = issue.anunciantes.filter((a) => !antes.has(a))
    const salen = anterior.anunciantes.filter((a) => !ahora.has(a))
    out.push('## Anunciantes')
    out.push('')
    out.push(`Entran: ${nuevos.join(', ') || '—'}`)
    out.push(`Salen: ${salen.join(', ') || '—'}`)
  }

  out.push('')
  out.push(
    `Base actual: ${insights.length} insights, ${Object.keys(fuentes).length} artículos citados. ` +
      `Revisado hasta ${ledger.revisado_hasta ?? 'nunca'}.`,
  )
  return out.join('\n') + '\n'
}

// The advertiser time series, derived from the issues rather than maintained
// separately, so it cannot drift out of sync with them.
async function writeAdvertisersCsv(issues) {
  const rows = ['edicion,anunciante']
  for (const issue of issues) {
    for (const a of issue.anunciantes) rows.push(`${issue.edicion},${a}`)
  }
  const path = join(EYS_DIR, 'anunciantes.csv')
  await writeFile(path, rows.join('\n') + '\n')
  return { path, filas: rows.length - 1 }
}

async function main() {
  const issues = await loadIssues()
  if (issues.length === 0) {
    throw new Error('No hay ediciones en data/eys/issues. Ejecuta antes scripts/eys-fetch.js')
  }

  if (process.argv.includes('--all')) {
    const md = await terrainMap(issues)
    const path = join(EYS_DIR, 'mapa.md')
    await writeFile(path, md)
    const csv = await writeAdvertisersCsv(issues)
    console.log(md)
    console.error(`\nEscrito en ${path} y ${csv.path} (${csv.filas} filas).`)
    return
  }

  console.log(await weeklyDossier(issues))
}

await main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
