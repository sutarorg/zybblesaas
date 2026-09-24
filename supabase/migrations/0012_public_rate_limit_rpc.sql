-- Expose ops.rate_limit_hit via PostgREST (which only exposes the public schema).
-- Fixes: "Could not find the function public.rate_limit_hit(p_bucket, p_limit, p_window_seconds) in the schema cache"
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_limit int,
  p_window_seconds int default 60
)
returns table (allowed boolean, remaining int, reset_seconds int)
language sql
security definer
set search_path = ops, public, pg_temp
as $$
  select * from ops.rate_limit_hit(p_bucket, p_limit, p_window_seconds);
$$;

revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

notify pgrst, 'reload schema';
