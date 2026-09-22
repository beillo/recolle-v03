# Recolle

Recolle maps urban waste and public space problems in A Coruña: containers overflowing,
illegal dumping, bulky items left on the street, damage to public space, and usable objects
being given away rather than thrown out. It builds that picture from public sources rather
than from the operator running the service, and plots it on a map anyone can open. It is
built as a portfolio and learning project, working on data capture, geospatial modelling,
a bit of applied AI, and the automation tying them together. It is not a commercial product
and is not for sale.

## Status: under active construction

This is a working project, not a finished one. The scope and the data model have both
already changed more than once, each time because real data came in and contradicted an
assumption: the geocoder turned out to be far less reliable at volume than the first batch
suggested, the basemap provider broke and had to be swapped, a field thought to be
geocoding metadata turned out to be load bearing, and the rule on citizen reporting was
rewritten rather than bent. Expect that to keep happening.

`docs/decisions.md` is the actual history: every decision, dated, with the reasoning and
with the corrections where an earlier call was wrong. It is the honest record, not this
file. `docs/schema.md` is the record schema as the data actually is, and `docs/queries.md`
is the query list the database was designed against.

**Live**: https://recolle-esp.vercel.app

## What works right now

The map is live and public. It loads every record from Postgres, colour codes it by
category, and shows source, date and photos in the popup. A resident can file a report from
the sidebar, which lands in a quarantine table that no browser can read back and that
nothing promotes automatically. From a record already in the dataset it will draft a formal
letter to the Concello, behind a serverless function so no credential reaches the browser.
There is an admin panel at `/admin` for reviewing the submission queue.

Two data sources feed it today:

- A public Facebook reuse group, captured through Apify, deduped by post URL, with images
  downloaded locally rather than hot-linked to a CDN that expires
- Concello da Coruña "avisos e incidencias de movilidad", filtered to physical
  interventions on the street, which publishes its own coordinate per notice so no
  geocoding is involved

As of 2026-09-22, verified against the live database: **142 records**, of which **126** carry
a coordinate and appear on the map and 16 remain unplaced with a recorded reason. 140 come
from the Facebook source and 2 from the Concello, spanning 2025-05-20 to 2026-09-16. Those
numbers move whenever a capture runs, so treat them as a reading, not a fixed figure.

## Stack

- React and Vite
- Leaflet for the map, Esri Light Gray tiles
- Supabase: Postgres with PostGIS, row level security, Storage for submitted photos
- Deployed on Vercel, with the serverless functions in `app/api/`

## Run locally

Requires Node and a Supabase project with the schema in `db/` applied.

```bash
cd app
npm install
cp .env.local.example .env.local   # then fill in the two values
npm run dev
```

`npm run build` produces the production bundle, `npm run preview` serves it, and
`npm run lint` runs oxlint. The two variables in `.env.local` are public by design and
bounded by row level security. The service role key is a different thing entirely, lives in
the root `.env`, never carries a `VITE_` prefix, and never reaches the browser.

## Repository layout

- `app/` the React application and its serverless functions
- `db/` the SQL applied to Supabase: schema, seed, functions, submissions, retention
- `data/` captured records, `records.json` as the flat mirror of the database, and images
- `scripts/` capture and maintenance tooling
- `docs/` schema, query list, and the decision log

## Open, not done

Pulled from `docs/decisions.md`, where each of these is recorded with its reasoning:

- No per visitor rate limit on citizen submissions. What exists is a global cap and a
  duplicate guard in Postgres, which cannot see the caller's IP. Closing this needs a
  captcha, Supabase Auth on the submit path, or an Edge Function in front, and it should be
  closed before the map is advertised anywhere
- Admin access is one shared token, not a user system. No accounts, no roles, no audit
  trail of who reviewed what
- Photos attached to citizen submissions have no retention rule yet. Records have one,
  30 or 90 days by category. The open question is what happens to the photo of a rejected
  submission
- The v0.3 brand identity is expected to change and the timing is deliberately open. The
  palette, typography and icons in use are carried over from v0.1 and v0.2 and should be
  treated as provisional
- The light basemap against the dark interface shell is an unresolved tension, noted when
  the frontend stack was chosen and still not settled by the tile provider change
- Whether `query` and `match`, the two geocoding provenance fields, belong in the final
  model is undecided until something other than a human auditing a coordinate reads them
- `records_by_zona()` and its client binding are kept as a stage deliverable but nothing
  in the interface renders them

## History

This is v0.3, a clean rewrite. v0.1 and v0.2 live untouched at `beillo/Recolle` as a frozen
historical record. That earlier version was a citizen reporting app abandoned for a
structural deadlock: no citizen data means no value for managers, no revenue means no way to
attract citizens. v0.3 removes that dependency. Citizen reports are still accepted, but as a
separate, quarantined input that never enters the dataset without a human promoting it.
