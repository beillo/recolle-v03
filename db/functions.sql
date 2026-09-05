-- Etapa 4.7, confirmed query from docs/queries.md: "Count records grouped by
-- zona." Exposed as a Postgres function so the app calls it via
-- supabase.rpc('records_by_zona') instead of pulling all rows and grouping
-- client side.

create or replace function public.records_by_zona()
returns table (zona text, count bigint)
language sql
stable
as $$
  select zona, count(*) as count
  from public.records
  group by zona
  order by count desc, zona asc;
$$;

-- Default for a SQL function is security invoker, so this runs with the
-- caller's own privileges. The existing "Public read access" RLS policy on
-- records (db/schema.sql) already covers it, no security definer needed.
-- Still needs its own explicit execute grant, same reasoning as the table's
-- explicit select grant: "automatically expose new tables" being off does
-- not extend a free pass to functions either, and this project does not
-- start anything open by default.
grant execute on function public.records_by_zona() to anon, authenticated;
