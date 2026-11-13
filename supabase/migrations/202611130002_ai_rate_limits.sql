-- Per-user, per-feature short-window protection for all AI-backed operations.
-- This is abuse protection only; it does not impose monthly or subscription quotas.
create table if not exists public.ai_rate_limits (
  user_id uuid not null,
  feature_key text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature_key)
);
alter table public.ai_rate_limits enable row level security;
revoke all on public.ai_rate_limits from public, anon, authenticated;

create or replace function public.consume_ai_rate_limit(
  p_user_id uuid,
  p_feature_key text,
  p_limit integer default 10,
  p_window_seconds integer default 60
)
returns table(allowed boolean, remaining integer, retry_after_s integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.ai_rate_limits%rowtype;
  v_now timestamptz := now();
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 120));
  v_window integer := greatest(1, least(coalesce(p_window_seconds, 60), 3600));
  v_feature text := left(coalesce(nullif(trim(p_feature_key), ''), 'unknown'), 80);
begin
  if p_user_id is null then
    raise exception 'A valid user is required';
  end if;
  insert into public.ai_rate_limits(user_id, feature_key, window_started_at, request_count, updated_at)
  values (p_user_id, v_feature, v_now, 0, v_now)
  on conflict (user_id, feature_key) do nothing;
  select * into v_row from public.ai_rate_limits
  where user_id = p_user_id and feature_key = v_feature for update;
  if v_now - v_row.window_started_at >= make_interval(secs => v_window) then
    update public.ai_rate_limits set window_started_at = v_now, request_count = 1, updated_at = v_now
    where user_id = p_user_id and feature_key = v_feature;
    return query select true, greatest(0, v_limit - 1), 0;
    return;
  end if;
  if v_row.request_count >= v_limit then
    return query select false, 0, greatest(1, ceil(extract(epoch from (v_row.window_started_at + make_interval(secs => v_window) - v_now)))::integer);
    return;
  end if;
  update public.ai_rate_limits set request_count = request_count + 1, updated_at = v_now
  where user_id = p_user_id and feature_key = v_feature;
  return query select true, greatest(0, v_limit - v_row.request_count - 1), 0;
end;
$$;
revoke all on function public.consume_ai_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_rate_limit(uuid, text, integer, integer) to service_role;
