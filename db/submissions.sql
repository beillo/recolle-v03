-- Etapa 5, side panel. Citizen submissions land here and ONLY here.
--
-- This table is deliberately not public.records. The dataset is fed by
-- scraping alone, that is the whole premise of v0.3, and a submission is an
-- unverified claim from an anonymous browser. Mixing the two would put
-- unaudited rows into the thing whose value is that it is audited. Anything
-- that ever moves from here into records does so through human review, by
-- hand, never automatically.
--
-- Run this in the Supabase SQL Editor after db/schema.sql.

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Same enum as records, so a reviewed submission can be promoted without a
  -- translation step.
  categoria text not null check (categoria in (
    'container_issue', 'illegal_dumping', 'bulk_waste',
    'urban_damage', 'circular_item', 'other'
  )),

  localizacion text not null check (
    length(btrim(localizacion)) between 3 and 200
  ),
  descripcion text check (length(descripcion) <= 1000),

  -- Optional, set when the submitter picked a point on the map.
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),

  -- Review state. Nothing here is trusted until a human says so.
  estado text not null default 'pending'
    check (estado in ('pending', 'accepted', 'rejected')),

  -- Set by review, points at the records.id this became, if any.
  promoted_to text references public.records(id)
);

create index submissions_estado_idx on public.submissions (estado, created_at desc);

alter table public.submissions enable row level security;

-- Insert only, and nothing else, for the public API roles.
--
-- The open Firestore write rule fixed in Etapa 0 is the thing this is written
-- against. The difference is that this grant is insert only on a quarantine
-- table: anon cannot select, update or delete, so a submission cannot be read
-- back, edited or removed from the browser, and the column checks above bound
-- what a single row can contain. estado and promoted_to are deliberately left
-- out of the insert grant below, so a submitter cannot mark their own row
-- accepted.
create policy "Anonymous submissions may be inserted"
  on public.submissions
  for insert
  to anon, authenticated
  with check (
    estado = 'pending'
    and promoted_to is null
  );

grant insert (categoria, localizacion, descripcion, lat, lng)
  on public.submissions to anon, authenticated;

-- Review happens with the service role key, from a trusted context, which
-- bypasses RLS. No select policy exists on purpose: the queue is not public.
--
-- Known gap, written down rather than left implicit: there is no rate limit
-- here. A determined script can insert rows until the Free Plan database
-- fills. Postgres alone cannot fix that, it needs either a captcha, Supabase
-- Auth on the submit path, or an Edge Function in front. Revisit before this
-- is advertised anywhere.
