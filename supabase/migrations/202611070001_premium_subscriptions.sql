-- Listora Premium subscriptions and server-side usage protection.
-- Apply after 202611040001_user_accounts.sql.
create table if not exists public.subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 stripe_customer_id text,
 stripe_subscription_id text unique,
 stripe_checkout_session_id text unique,
 stripe_price_id text,
 plan_key text check (plan_key is null or plan_key = 'monthly'),
 status text not null default 'incomplete' check (status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
 current_period_start timestamptz,
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 canceled_at timestamptz,
 past_due_since timestamptz,
 past_due_grace_until timestamptz,
 last_payment_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_customer_id_idx on public.subscriptions(stripe_customer_id);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.subscription_events (
 id uuid primary key default gen_random_uuid(),
 stripe_event_id text not null unique,
 event_type text not null,
 user_id uuid references auth.users(id) on delete set null,
 payload jsonb not null default '{}'::jsonb,
 processed_at timestamptz,
 processing_error text,
 created_at timestamptz not null default now()
);
alter table public.subscription_events enable row level security;
revoke all on public.subscription_events from anon, authenticated;

create table if not exists public.premium_usage (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 feature_key text not null,
 request_id text,
 created_at timestamptz not null default now()
);
create index if not exists premium_usage_user_created_idx on public.premium_usage(user_id, created_at desc);
alter table public.premium_usage enable row level security;
revoke all on public.premium_usage from anon, authenticated;

create table if not exists public.premium_rate_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_started_at timestamptz not null default now(),
 request_count integer not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.premium_rate_limits enable row level security;
revoke all on public.premium_rate_limits from anon, authenticated;

create or replace function public.consume_premium_rate_limit(p_user_id uuid, p_feature_key text, p_request_id text default null, p_limit integer default 10, p_window_seconds integer default 60)
returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer set search_path = ''
as $$
declare v_row public.premium_rate_limits%rowtype; v_now timestamptz := now();
begin
 insert into public.premium_rate_limits(user_id,window_started_at,request_count,updated_at) values(p_user_id,v_now,0,v_now) on conflict(user_id) do nothing;
 select * into v_row from public.premium_rate_limits where user_id=p_user_id for update;
 if v_now-v_row.window_started_at >= make_interval(secs=>greatest(1,p_window_seconds)) then
  update public.premium_rate_limits set window_started_at=v_now,request_count=1,updated_at=v_now where user_id=p_user_id;
  insert into public.premium_usage(user_id,feature_key,request_id) values(p_user_id,left(coalesce(p_feature_key,'unknown'),80),nullif(left(p_request_id,120),''));
  return query select true,greatest(0,p_limit-1),0; return;
 end if;
 if v_row.request_count >= greatest(1,p_limit) then
  return query select false,0,greatest(1,ceil(extract(epoch from (v_row.window_started_at+make_interval(secs=>greatest(1,p_window_seconds))-v_now)))::integer); return;
 end if;
 update public.premium_rate_limits set request_count=request_count+1,updated_at=v_now where user_id=p_user_id;
 insert into public.premium_usage(user_id,feature_key,request_id) values(p_user_id,left(coalesce(p_feature_key,'unknown'),80),nullif(left(p_request_id,120),''));
 return query select true,greatest(0,p_limit-v_row.request_count-1),0;
end; $$;
revoke all on function public.consume_premium_rate_limit(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_premium_rate_limit(uuid,text,text,integer,integer) to service_role;

create or replace function public.set_subscription_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_subscription_updated_at();


-- One free, server-enforced comparison per Supabase identity (including guest sessions).
create table if not exists public.premium_comparison_trials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 used_at timestamptz not null default now(),
 request_id text not null
);
alter table public.premium_comparison_trials enable row level security;
revoke all on public.premium_comparison_trials from public, anon, authenticated;

create or replace function public.consume_free_comparison_trial(p_user_id uuid, p_request_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_inserted integer;
begin
 insert into public.premium_comparison_trials(user_id, request_id)
 values (p_user_id, left(p_request_id,120))
 on conflict (user_id) do nothing;
 get diagnostics v_inserted = row_count;
 return v_inserted = 1;
end;
$$;
revoke all on function public.consume_free_comparison_trial(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_free_comparison_trial(uuid,text) to service_role;
