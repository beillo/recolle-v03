# Recolle

Recolle turns scattered public information about urban waste collection into a geolocalized dataset that is structurally independent from the operator being audited. The core output is a live map of blackspots, container issues, illegal dumping, and reusable items, built without relying on data the operator itself produces.

**Live**: https://app-nu-ruby-47.vercel.app

## Why this exists

Waste management data in Spain is either owned by the operator running the service (IoT sensors from MOVISAT, Sensoneo, MOBA, and similar) or not collected at all. Nobody audits the audited. Independence from the operator is the whole value proposition: a client cannot be the party being measured.

The regulatory wedge is concrete: Ley 7/2022 requires separate biowaste collection in Spain, with a hard threshold of under 15% impropios by 2027 to count as compliant. Galicia has active public funding tied to this. Demand here is regulatory, not discretionary.

## What it does

- Scrapes and geocodes public posts (a Facebook reuse group) and official municipal notices (Concello da Coruna mobility incidents) into one schema
- Plots every record on an interactive map, colour coded by category, with a popup showing the source, date, and photos
- Lets a resident report an issue directly from the map. Reports land in a quarantine table and never enter the audited dataset automatically, only a human review can promote one
- Drafts a formal letter to the Concello from any record, using a small language model behind a server side function, so a credential never reaches the browser

## Stack

- **Frontend**: React + Vite, Leaflet for the map, deployed on Vercel
- **Database**: Postgres with PostGIS on Supabase, accessed from the browser with a public key restricted by row level security
- **Letter drafting**: `claude-haiku-4-5` called from a Vercel serverless function, API key held server side only
- **Data capture**: Apify for the scraped source, direct fetch and parse for the municipal source, images downloaded and served locally rather than hot-linked

## Repository layout

- `app/` the React application and its serverless functions
- `db/` SQL schema, seed data, and Postgres functions, applied directly to Supabase
- `data/` captured records and their images
- `scripts/` data capture tooling
- `docs/` schema notes, the query list the database was designed against, and a dated log of every decision made along the way and why

## History

This is v0.3, a clean rewrite. It is not a continuation of the earlier prototype, which lives untouched at `beillo/Recolle` (v0.1, v0.2) as a separate, frozen historical record. That earlier version was a citizen reporting app (B2B2C) abandoned for a structural deadlock: no citizen data means no value for managers, no revenue means no way to attract citizens. v0.3 removes that dependency, an automated B2B pipeline that does not need citizen participation to exist, while still accepting citizen reports as a separate, clearly labelled input that never bypasses review.
