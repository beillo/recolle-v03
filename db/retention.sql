-- Photo retention. Applied to Supabase on 2026-09-10, transcribed here from
-- the live database with pg_get_functiondef and pg_get_viewdef so the file and
-- the project cannot drift apart.
--
-- The rule: a record never leaves the map, only its photo goes. Hotspot and
-- recurrence by zona live on point, date and category; the photo illustrates a
-- circular_item and evidences a complaint, and only the second one needs to
-- survive long. The window counts from records.fecha, not from capture time.
--
-- Postgres decides WHAT to recycle. It cannot delete anything: the paths in
-- records.imagen point into this repository. scripts/recycle-photos.js does the
-- deleting, file first and database second, and the reason that order is fixed
-- is written at the top of that file.

create table if not exists public.photo_retention_policy (
  categoria text primary key,
  dias integer not null check (dias > 0)
);

-- The window is data, not a constant in code: moving circular_item from 30 to
-- 45 days is an update, not a deployment.
insert into public.photo_retention_policy (categoria, dias) values
  ('circular_item',   30),   -- a donated object stops existing in days
  ('illegal_dumping', 90),   -- evidence, and 90 days covers the complaint window
  ('bulk_waste',      90),
  ('urban_damage',    90)
on conflict (categoria) do nothing;

-- 90 days is the conservative fallback, so a category added later is kept
-- longer by default rather than recycled early by accident.
create or replace function public.retencion_dias(p_categoria text)
returns integer
language sql
stable
set search_path to ''
as $$
  select coalesce(
    (select dias from public.photo_retention_policy where categoria = p_categoria),
    90
  );
$$;

-- Distinguishes "never had a photo" from "had one and it was recycled".
alter table public.records add column if not exists imagen_reciclada_at timestamptz;

-- The queue. Strictly greater than the window, so a record on its exact
-- boundary day is not yet included.
create or replace view public.fotos_a_reciclar as
  select id,
         categoria,
         fecha,
         imagen as arquivos,
         public.retencion_dias(categoria) as dias_politica,
         current_date - fecha as dias_de_vida
    from public.records
   where imagen is not null
     and cardinality(imagen) > 0
     and imagen_reciclada_at is null
     and fecha < (current_date - public.retencion_dias(categoria));

-- Called only after the files are actually gone. Skips rows already marked, so
-- a re-run after a partial failure is safe.
create or replace function public.marcar_fotos_recicladas(p_ids text[])
returns integer
language sql
set search_path to ''
as $$
  with atualizados as (
    update public.records
       set imagen = null,
           imagen_reciclada_at = now()
     where id = any(p_ids)
       and imagen_reciclada_at is null
    returning 1
  )
  select count(*)::integer from atualizados;
$$;

-- The cleanup job is privileged. records has no update policy for the public
-- roles, and these two are revoked on top of that, so only the service role
-- can move a photo out of the dataset.
revoke execute on function public.marcar_fotos_recicladas(text[]) from public, anon, authenticated;
revoke execute on function public.retencion_dias(text) from public, anon, authenticated;

-- Added after the first real run, which failed with 42501 twice. Creating a
-- table or a view grants service_role nothing in this project: "automatically
-- expose new tables" is off, and bypassing row level security is not the same
-- as holding a table privilege. The public roles are untouched, so the queue
-- and the policy stay unreadable from a browser.
grant select on public.fotos_a_reciclar to service_role;
grant select, insert, update, delete on public.photo_retention_policy to service_role;
grant execute on function public.marcar_fotos_recicladas(text[]) to service_role;
grant execute on function public.retencion_dias(text) to service_role;
