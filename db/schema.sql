-- Etapa 4.2. Postgres/PostGIS schema for the records table.
-- Field choices follow docs/schema.md (schema v2) and the modeling decisions
-- in docs/decisions.md dated 2026-09-03 and 2026-09-04. Run this once in the
-- Supabase SQL Editor against the project created for this stage.

create extension if not exists postgis;

create table public.records (
  id text primary key,

  -- Six values confirmed in docs/schema.md schema v2, three in use so far.
  categoria text not null check (categoria in (
    'container_issue', 'illegal_dumping', 'bulk_waste',
    'urban_damage', 'circular_item', 'other'
  )),

  severidad integer check (severidad between 1 and 3),
  localizacion text,
  fecha date not null,

  -- fuente was an object in the flat file ({ tipo, url, grupo }), flattened
  -- into columns here. fuente_url is unique because it is the key the
  -- "does this post exist" query (docs/queries.md) checks before Etapa 5
  -- decides insert versus update.
  fuente_tipo text not null,
  fuente_url text not null unique,
  fuente_grupo text,

  descripcion text not null,
  imagen text[],
  confidence numeric check (confidence between 0 and 1),
  zona text,

  -- Coordinate decision, docs/decisions.md 2026-09-04: lat, lng and
  -- precision are first class fields, not geocoding metadata, because the
  -- 4.7 radius query is specified as filtered by precision. query and
  -- match are the Photon provenance strings, kept for now, undecided
  -- whether they survive past this migration. reason explains a record
  -- that failed geocoding entirely (today, only id 025) and has no
  -- coordinate or precision.
  lat double precision,
  lng double precision,
  precision text check (precision in (
    'neighbourhood', 'landmark', 'address', 'street'
  )),
  query text,
  match text,
  reason text,

  -- Set when the photo retention window passed and the image files were
  -- deleted from the repository. Null while the photo still exists, which is
  -- what separates "never had a photo" from "had one and it was recycled".
  -- Policy and queue live in db/retention.sql.
  imagen_reciclada_at timestamptz,

  -- Generated from lat/lng rather than written directly, so the two never
  -- drift apart. Backs the 4.7 radius-filtered-by-precision query with
  -- st_dwithin against the gist index below.
  geom geography(Point, 4326) generated always as (
    case when lat is not null and lng is not null
      then st_setsrid(st_makepoint(lng, lat), 4326)::geography
    end
  ) stored
);

create index records_geom_idx on public.records using gist (geom);
create index records_zona_idx on public.records (zona);

-- Belt and suspenders: the project already has "Enable automatic RLS" on,
-- so this table is created locked down with no policies. This line makes
-- the script self contained even if that project setting ever changes.
alter table public.records enable row level security;

-- Read only for the public API roles. No insert, update or delete policy
-- for anon or authenticated: this is the Postgres equivalent of the open
-- Firestore write rule fixed in Etapa 0, and it does not get repeated here.
-- Capture and import scripts write with the service role key, which
-- bypasses RLS, from a trusted context, never from the browser.
create policy "Public read access"
  on public.records
  for select
  to anon, authenticated
  using (true);

-- "Automatically expose new tables" is off for this project, so table
-- level privilege has to be granted explicitly, on top of the RLS policy
-- above. Without this grant, PostgREST returns permission denied even
-- though the policy would allow the row.
grant select on public.records to anon, authenticated;
