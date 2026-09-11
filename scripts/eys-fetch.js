// Reads the EySMunicipales weekly newsletter archive and extracts each issue
// into data/eys/issues/<fecha>.json. Etapa 6, the market surveillance stage.
//
// Usage:
//   node scripts/eys-fetch.js                  only issues not captured yet
//   node scripts/eys-fetch.js --all            the whole archive, for the backfill
//   node scripts/eys-fetch.js --reparse      re-extract from the raw cache, offline
//   node scripts/eys-fetch.js --article <url>  clean text of one article, to stdout
//
// No API key and no dependencies: the archive is public, the pages are static
// email HTML, and the markup is Drupal with named field classes, so a regex is
// enough and adding cheerio to a repo that has no scripting deps is not worth it.
//
// The issue page already carries, for every item, the headline, a two line
// summary and the category. That is the whole point of parsing it: a week can be
// triaged without fetching a single article, and only the two or three items
// that survive the filter cost a second request.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const BASE = 'https://www.eysmunicipales.es'
const ROOT = resolve(import.meta.dirname, '..')
const RAW_DIR = join(ROOT, 'data', 'eys', 'raw')
const ISSUES_DIR = join(ROOT, 'data', 'eys', 'issues')

// The archive was 4 pages in September 2026 and grows by one every ten weeks.
// The walk stops on the first page with no issues, so this is only a guard
// against a pagination bug turning into an unbounded crawl.
const MAX_PAGES = 40

const NAMED = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç',
  agrave: 'à', egrave: 'è', ograve: 'ò', iquest: '¿', iexcl: '¡',
  ordm: 'º', ordf: 'ª', deg: '°', euro: '€', middot: '·', bull: '•',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  sup2: '²', sup3: '³', frac12: '½', frac14: '¼', times: '×', shy: '',
  // Found by sweeping the extracted corpus for surviving &entity; tokens,
  // not guessed: German and Catalan company names, and unit and mark symbols.
  reg: '®', trade: '™', copy: '©', acute: '´', mu: 'µ', sect: '§',
  auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö', euml: 'ë', iuml: 'ï',
  atilde: 'ã', Atilde: 'Ã', otilde: 'õ', Otilde: 'Õ',
  Agrave: 'À', Egrave: 'È', ugrave: 'ù', igrave: 'ì',
  aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', szlig: 'ß',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
}

// Numeric references in the 0x80-0x9F range are not Unicode code points: in
// practice they mean Windows-1252, which is where the smart quotes and dashes
// of a copy-pasted press release end up. Decoding them literally yields C1
// control characters, and anything outside the range can be a lone surrogate,
// which is not merely wrong but unencodable, so writing it to JSON throws.
const CP1252 = {
  0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ',
  0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–',
  0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ',
  0x9e: 'ž', 0x9f: 'Ÿ',
}

function codePoint(n) {
  if (n >= 0x80 && n <= 0x9f) return CP1252[n] ?? ''
  if (!Number.isInteger(n) || n <= 0 || n > 0x10ffff) return ''
  if (n >= 0xd800 && n <= 0xdfff) return ''
  return String.fromCodePoint(n)
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePoint(Number(d)))
    // [a-z0-9] and not [a-z]: sup2, sup3 and frac12 carry digits.
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) => (name in NAMED ? NAMED[name] : m))
}

function text(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

// Drupal renders each field as <span|div class="field field--name-<name> ...">.
// The values here are plain strings with no nested markup, so stopping at the
// first closing tag is safe.
function field(block, name) {
  const re = new RegExp(`<(span|div)[^>]*field--name-${name}[^>]*>([\\s\\S]*?)</\\1>`)
  const m = block.match(re)
  return m ? text(m[2]) : ''
}

async function get(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'recolle-v03 etapa6 (https://github.com/beillo/recolle-v03)' },
  })
  if (!res.ok) throw new Error(`${url} respondió ${res.status}`)
  return res.text()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Banner slugs look like "contenur-newsletter-JxZUYsDlgOzW36OaIziTpVbZ" or
// "carandini-2026-lSNmYGZSINI6IgF7qjHcNg29": a name, sometimes a qualifier, and
// always a random id. Dropping the id and the qualifier leaves the advertiser,
// which is the part worth tracking over time. Some banners are only an id, with
// no name at all, and those are skipped rather than recorded as noise.
function advertiserName(slug) {
  const parts = slug.split('-')
  while (parts.length > 0) {
    const last = parts[parts.length - 1]
    const random = last.length >= 10 && /[a-z]/.test(last) && /[A-Z0-9]/.test(last)
    const qualifier = /^(newsletter|web|banner|nl|2\d{3})$/i.test(last)
    if (!random && !qualifier) break
    parts.pop()
  }
  return parts.join('-').toLowerCase()
}

const ITEM_LINK = /href="(https:\/\/www\.eysmunicipales\.es\/(?:actualidad|articulos)\/[^"#]+)"/

// Template A, from 2022-12-02 onward: every item is one <article role="article">
// block carrying Drupal fields. Blocks with no link to actualidad or articulos
// are banners and layout, and are dropped.
function itemsFromArticles(html) {
  const items = []
  for (const block of html.split('<article role="article"').slice(1)) {
    const link = block.match(ITEM_LINK)
    const titulo = link && field(block, 'title')
    if (!titulo) continue
    items.push({
      titulo,
      resumen: field(block, 'field-subtitulo'),
      categoria: field(block, 'field-categoria'),
      url: link[1],
    })
  }
  return items
}

// Template B, 2019-07-18 to 2022-11-25: a plain email table whose cells are
// classed noticia-title and noticia-subtitle. Splitting on the title class puts
// each item in its own chunk, so the first subtitle in a chunk belongs to it.
// This template has no category field at all, which is why categoria comes back
// empty for these years rather than guessed.
function itemsFromTable(html) {
  const items = []
  for (const chunk of html.split('class="noticia-title"').slice(1)) {
    const link = chunk.match(ITEM_LINK)
    if (!link) continue
    const anchor = chunk.match(/<a[^>]*>([\s\S]*?)<\/a>/)
    const titulo = anchor ? text(anchor[1]) : ''
    if (!titulo) continue
    const dek = chunk.match(/class="noticia-subtitle[^"]*"[^>]*>([\s\S]*?)<\/td>/)
    items.push({
      titulo,
      resumen: dek ? text(dek[1]) : '',
      categoria: '',
      url: link[1],
    })
  }
  return items
}

// Three templates have shipped since 2018. A and B are parsed; C, used from
// 2018-09 to 2019-07, is deliberately left alone: 41 issues, the oldest and
// least relevant period, and a third parser to maintain forever. Returning null
// is what keeps that a recorded omission instead of a silent failure.
function detectTemplate(html) {
  if (html.includes('<article role=')) return 'A'
  if (html.includes('class="noticia-title"')) return 'B'
  return null
}

function parseIssue(html, fecha, plantilla) {
  const seen = new Set()
  const found = plantilla === 'A' ? itemsFromArticles(html) : itemsFromTable(html)

  // The same article occasionally appears twice in one issue, once as a
  // highlight and once in the body list.
  const items = found.filter((it) => !seen.has(it.url) && seen.add(it.url))

  const anunciantes = [
    ...new Set(
      [...html.matchAll(/href="(?:https:\/\/www\.eysmunicipales\.es)?\/?media\/([^"?#]+)"/g)]
        .map((m) => advertiserName(m[1]))
        .filter(Boolean),
    ),
  ].sort()

  return {
    edicion: fecha,
    url: `${BASE}/enewsletters/enews-_${fecha}.html`,
    capturado_en: new Date().toISOString(),
    // Consumers need this: template B carries no category field, so an empty
    // categoria before 2022-12 means "never published", not "uncategorised".
    plantilla,
    items,
    anunciantes,
  }
}

function parseArticle(html, url) {
  const pick = (re) => {
    const m = html.match(re)
    return m ? text(m[1]) : ''
  }
  // Slice from the end of the opening tag, not from the class name, or the
  // attribute remnant lands at the head of the quoted text.
  const open = html.indexOf('text-noticia"')
  const body = open === -1 ? '' : html.slice(html.indexOf('>', open) + 1)
  const cut = body.search(/<footer|Noticias relacionadas|Te puede interesar/i)

  return {
    url,
    titulo: pick(/<meta property="og:title" content="([^"]*)"/),
    fuente: pick(/href="entidades\/[^"]*"[^>]*>([\s\S]*?)<\/a>/),
    fecha: pick(/<p>(\d{2}\/\d{2}\/\d{4})</),
    categoria: pick(/href="actualidad-archivo\/[^"]*"[^>]*class="category"[^>]*>([\s\S]*?)<\/a>/),
    temas: [...html.matchAll(/href="tema\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1])),
    cuerpo: text(cut === -1 ? body : body.slice(0, cut)),
  }
}

async function capturedDates() {
  const files = await readdir(ISSUES_DIR).catch(() => [])
  return new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)))
}

// Walks the archive newest first. Without --all it stops as soon as a page
// holds nothing new, which is the ordinary weekly case: one request, one issue.
async function archiveDates(all, known) {
  const dates = []
  for (let pag = 1; pag <= MAX_PAGES; pag++) {
    const html = await get(pag === 1 ? `${BASE}/newsletter` : `${BASE}/newsletter?pag=${pag}`)
    const found = [...new Set([...html.matchAll(/enews-_(\d{4}-\d{2}-\d{2})\.html/g)].map((m) => m[1]))]
    if (found.length === 0) break

    const nuevas = found.filter((d) => !known.has(d))
    dates.push(...nuevas)
    if (!all && nuevas.length === 0) break
    await sleep(200)
  }
  return [...new Set(dates)].sort()
}

async function main() {
  const args = process.argv.slice(2)

  const articleAt = args.indexOf('--article')
  if (articleAt !== -1) {
    const url = args[articleAt + 1]
    if (!url) throw new Error('Uso: node scripts/eys-fetch.js --article <url>')
    console.log(JSON.stringify(parseArticle(await get(url), url), null, 2))
    return
  }

  const all = args.includes('--all')
  const reparse = args.includes('--reparse')
  await mkdir(RAW_DIR, { recursive: true })
  await mkdir(ISSUES_DIR, { recursive: true })

  const known = await capturedDates()

  // --reparse never touches the network: it re-extracts every issue already in
  // the raw cache. That is the loop for changing the parser, and it keeps a fix
  // from costing four hundred requests to a site that owes us nothing.
  const pendientes = reparse
    ? (await readdir(RAW_DIR).catch(() => []))
        .filter((f) => f.endsWith('.html'))
        .map((f) => f.slice('enews-'.length, -'.html'.length))
        .sort()
    : await archiveDates(all, known)

  if (pendientes.length === 0) {
    console.log(`Sin ediciones nuevas. ${known.size} ya capturadas en data/eys/issues.`)
    return
  }

  console.log(`${pendientes.length} ediciones por capturar.`)
  const vacias = []
  const omitidas = []

  for (const fecha of pendientes) {
    const rawPath = join(RAW_DIR, `enews-${fecha}.html`)

    // Reuse the raw HTML when it is already on disk. The archive reaches back to
    // 2018 and uses more than one email template, so the parser will keep
    // changing as older ones turn up; re-parsing must not mean re-downloading.
    let html = await readFile(rawPath, 'utf8').catch(() => null)
    const enCache = html !== null

    if (!enCache) {
      try {
        html = await get(`${BASE}/enewsletters/enews-_${fecha}.html`)
      } catch (err) {
        console.error(`  ! ${fecha}: ${err.message}`)
        vacias.push(fecha)
        continue
      }
      await writeFile(rawPath, html)
    }

    const plantilla = detectTemplate(html)
    if (!plantilla) {
      omitidas.push(fecha)
      continue
    }

    const issue = parseIssue(html, fecha, plantilla)

    // A recognised template that yields nothing is a parser failure, not an
    // empty week, and has to be loud: writing an empty JSON would hide the
    // drift behind a file that looks captured.
    if (issue.items.length === 0) {
      console.error(`  ! ${fecha}: plantilla ${plantilla} reconocida, 0 items extraídos`)
      vacias.push(fecha)
      continue
    }

    await writeFile(join(ISSUES_DIR, `${fecha}.json`), JSON.stringify(issue, null, 2) + '\n')
    console.log(
      `  ${fecha}  ${String(issue.items.length).padStart(2)} items  ` +
        `${issue.anunciantes.length} anunciantes${enCache ? '  (cache)' : ''}`,
    )
    if (!enCache) await sleep(200)
  }

  const total = (await capturedDates()).size
  console.log(`\n${total} ediciones en data/eys/issues.`)
  if (omitidas.length > 0) {
    console.log(
      `${omitidas.length} omitidas por plantilla antigua sin soporte ` +
        `(${omitidas[0]} .. ${omitidas[omitidas.length - 1]}). Decisión, no error.`,
    )
  }

  if (vacias.length > 0) {
    console.error(
      `${vacias.length} ediciones sin extraer: ${vacias.join(', ')}\n` +
        'El HTML está en data/eys/raw, revisa el parser antes de seguir.',
    )
    process.exitCode = 1
  }
}

await main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
