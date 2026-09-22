# CLAUDE.md

How to work in this repository. Written for a new session with zero prior context.

Live: https://recolle-esp.vercel.app

## What this is

Recolle v0.3: an independent, geolocalized dataset of urban waste problems in A Coruna,
built from scraped and public sources, kept structurally separate from the operator being
audited. Read README.md for the why. v0.1 and v0.2 are a different, frozen repository,
`beillo/Recolle`, never modified from here.

## Stack

- Frontend: React 19 + Vite 8, Leaflet 1.9 with react-leaflet 5, in `app/`
- Serverless functions: `app/api/`, deployed with the frontend
- Database: Postgres with PostGIS on Supabase, client is `@supabase/supabase-js`
- Hosting: Vercel, project `recolle-v03`, Root Directory `app`, no git link.
  Deploys are manual: run `vercel --prod` from the repository root, not from `app/`.

## Where things live

- `data/records.json`: the flat file record of what is actually in the database. Kept in
  sync with it deliberately, so it is a full snapshot, not a partial history.
- `data/images/`: capture photos, bundled by Vite straight from here.
- `data/raw/`: raw scraped exports, gitignored, contains personal data, never committed.
- `db/`: the SQL applied to Supabase. `schema.sql` (records table and its policies),
  `seed.sql` (generated from `data/records.json`), `functions.sql`, `submissions.sql`,
  `retention.sql`.
- `scripts/`: data capture tooling.

## Writes to the database

Row level security is on, and the public roles cannot write the audited dataset.

- `records`: `anon` and `authenticated` have select only, via the "Public read access"
  policy plus an explicit select grant. There is no insert, update or delete policy for
  them. This is the Postgres answer to the open Firestore write rule fixed in Etapa 0.
- `submissions`: one deliberate exception. `anon` and `authenticated` may insert, on five
  named columns only, with `estado` forced to `pending`. They cannot select, update or
  delete, so a citizen report lands in quarantine and can never be read back, edited, or
  promoted from the browser.

Every real write goes through the service role: manual SQL in the Supabase SQL editor, or
a script using `SUPABASE_SERVICE_ROLE_KEY`. That key bypasses RLS entirely. It lives in
the root `.env`, never in `app/.env.local`, never with a `VITE_` prefix (anything `VITE_`
is inlined into the browser bundle), and is never committed. The browser only ever gets
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, both public by design and bounded by the
policies above.

## Source of truth

- `docs/schema.md`: the record schema as the data actually is.
- `docs/decisions.md`: every decision, dated, with reasoning. Append only, never edit a
  past entry, a changed decision gets a new one.
- `docs/queries.md`: the query list the database was designed against.

Those three outrank this file. If anything here disagrees with them, they are right and
this file is stale. Above all of them is the running code: documentation in this project
has been wrong before, more than once, on the framework version, the map tile provider,
and the category values. If a claim has not been checked against the code or the data, say
so instead of stating it as fact.

## Style

No em dash in generated text or documentation. Comma or colon instead.
