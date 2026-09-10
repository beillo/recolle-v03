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

-- Added 2026-09-10 with the photo upload carried over from v0.2.
alter table public.submissions add column imagen text;

grant insert (categoria, localizacion, descripcion, lat, lng, imagen)
  on public.submissions to anon, authenticated;

-- Private bucket. 4 MB per file, images only, enforced by Storage itself so a
-- crafted client cannot talk its way past a check that only lives in the
-- browser. The browser side check in app/src/data/submissions.js exists to
-- fail fast with a readable message, not as the control.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-photos',
  'submission-photos',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Upload only, same shape as the table above: anon may put a file in and can do
-- nothing else with it. No select policy, so the bucket cannot be listed or
-- read from a browser, and no update or delete, so an uploaded file cannot be
-- swapped or removed after the fact. Review reads it with the service role key.
create policy "Anonymous submission photos may be uploaded"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'submission-photos');

-- Added 2026-09-10. Rate limit on the submit path, closing the gap recorded
-- above, though only partly and it says so.
--
-- Postgres cannot see the caller's IP, so this is a global cap plus a duplicate
-- guard, not a per-visitor limit. It is the crude version deliberately: it
-- needs no extra service and works with the anon insert grant that already
-- exists. A real per-visitor limit needs a captcha, Supabase Auth on the submit
-- path, or an Edge Function in front, and that decision is still open.
--
-- SECURITY DEFINER because the inserting role is anon, which has insert and no
-- select here, so it cannot count anything by itself. EXECUTE is revoked from
-- the public roles so the function is reachable only through the trigger and
-- never through /rest/v1/rpc.
create or replace function public.submissions_throttle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recientes integer;
  repetidos integer;
begin
  select count(*) into recientes
  from public.submissions
  where created_at > now() - interval '1 hour';

  if recientes >= 30 then
    raise exception 'Demasiados avisos en la ultima hora. Intentalo mas tarde.'
      using errcode = '54000';
  end if;

  select count(*) into repetidos
  from public.submissions
  where categoria = new.categoria
    and lower(btrim(localizacion)) = lower(btrim(new.localizacion))
    and created_at > now() - interval '24 hours';

  if repetidos >= 3 then
    raise exception 'Ya hay avisos iguales para esta ubicacion en las ultimas 24 horas.'
      using errcode = '54000';
  end if;

  return new;
end;
$$;

revoke execute on function public.submissions_throttle() from public, anon, authenticated;

drop trigger if exists submissions_throttle_trg on public.submissions;
create trigger submissions_throttle_trg
  before insert on public.submissions
  for each row execute function public.submissions_throttle();
