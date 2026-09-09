// Fetches the dataset from the last successful run of the Facebook Groups
// Scraper actor and saves it to data/raw/, replacing the manual
// run > export JSON > download > paste flow used for the first batch.
// Usage: node --env-file=.env scripts/fetch-apify.js

const ACTOR_ID = 'apify~facebook-groups-scraper'

const token = process.env.APIFY_TOKEN
if (!token) {
  console.error('APIFY_TOKEN not set. Run with: node --env-file=.env scripts/fetch-apify.js')
  process.exit(1)
}

const url = `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_ID)}/runs/last/dataset/items?token=${token}&status=SUCCEEDED`

const res = await fetch(url)
if (!res.ok) {
  console.error(`Apify API returned ${res.status}: ${await res.text()}`)
  process.exit(1)
}

const items = await res.json()
const date = new Date().toISOString().slice(0, 10)
const outPath = `data/raw/apify-export-${date}.json`

await import('node:fs/promises').then((fs) =>
  fs.writeFile(outPath, JSON.stringify(items, null, 2)),
)

console.log(`Saved ${items.length} posts to ${outPath}`)
