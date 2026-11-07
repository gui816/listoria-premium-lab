-- Smart Comparison conversion cohorts: one row when the first free estimate succeeds,
-- and one row when the user's first real Stripe invoice is paid.
-- Demo subscriptions are intentionally excluded from paid conversion metrics.

create table if not exists public.premium_comparison_cohorts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_free_comparison_at timestamptz not null default now(),
  request_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists premium_comparison_cohorts_first_at_idx
  on public.premium_comparison_cohorts(first_free_comparison_at);
alter table public.premium_comparison_cohorts enable row level security;
revoke all on public.premium_comparison_cohorts from public, anon, authenticated;

create table if not exists public.premium_paid_conversions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_paid_at timestamptz not null,
  stripe_subscription_id text not null,
  stripe_invoice_id text not null unique,
  amount_paid integer,
  currency text,
  created_at timestamptz not null default now()
);
create index if not exists premium_paid_conversions_paid_at_idx
  on public.premium_paid_conversions(first_paid_at);
alter table public.premium_paid_conversions enable row level security;
revoke all on public.premium_paid_conversions from public, anon, authenticated;

-- Monthly cohort report. Rates are only calculated when the full observation
-- window has elapsed; immature cohorts return NULL rather than misleading rates.
create or replace view public.premium_comparison_conversion_monthly as
with cohorts as (
  select
    date_trunc('month', c.first_free_comparison_at)::date as cohort_month,
    c.user_id,
    c.first_free_comparison_at,
    p.first_paid_at
  from public.premium_comparison_cohorts c
  left join public.premium_paid_conversions p
    on p.user_id = c.user_id
   and p.first_paid_at >= c.first_free_comparison_at
),
aggregated as (
  select
    cohort_month,
    count(*)::integer as free_comparison_users,
    count(*) filter (where first_paid_at >= first_free_comparison_at
      and first_paid_at <= first_free_comparison_at + interval '7 days')::integer as converted_7d,
    count(*) filter (where first_paid_at >= first_free_comparison_at
      and first_paid_at <= first_free_comparison_at + interval '30 days')::integer as converted_30d,
    count(*) filter (where first_paid_at >= first_free_comparison_at
      and first_paid_at <= first_free_comparison_at + interval '60 days')::integer as converted_60d,
    count(*) filter (where first_free_comparison_at <= now() - interval '7 days')::integer as mature_7d,
    count(*) filter (where first_free_comparison_at <= now() - interval '30 days')::integer as mature_30d,
    count(*) filter (where first_free_comparison_at <= now() - interval '60 days')::integer as mature_60d,
    count(*) filter (where first_free_comparison_at <= now() - interval '7 days'
      and first_paid_at >= first_free_comparison_at
      and first_paid_at <= first_free_comparison_at + interval '7 days')::integer as mature_converted_7d,
    count(*) filter (where first_free_comparison_at <= now() - interval '30 days'
      and first_paid_at >= first_free_comparison_at
      and first_paid_at <= first_free_comparison_at + interval '30 days')::integer as mature_converted_30d,
    count(*) filter (where first_free_comparison_at <= now() - interval '60 days'
      and first_paid_at >= first_free_comparison_at
      and first_paid_at <= first_free_comparison_at + interval '60 days')::integer as mature_converted_60d
  from cohorts
  group by cohort_month
)
select
  cohort_month,
  free_comparison_users,
  converted_7d,
  converted_30d,
  converted_60d,
  mature_7d,
  case when mature_7d > 0 then round(100.0 * mature_converted_7d / mature_7d, 2) end as conversion_rate_7d_pct,
  mature_30d,
  case when mature_30d > 0 then round(100.0 * mature_converted_30d / mature_30d, 2) end as conversion_rate_30d_pct,
  mature_60d,
  case when mature_60d > 0 then round(100.0 * mature_converted_60d / mature_60d, 2) end as conversion_rate_60d_pct
from aggregated;

comment on table public.premium_comparison_cohorts is
  'Cohort entry: first successful free Smart Comparison per Supabase user identity.';
comment on table public.premium_paid_conversions is
  'First successful real Stripe invoice payment per user; excludes demo subscriptions.';
comment on view public.premium_comparison_conversion_monthly is
  'Monthly free Smart Comparison cohorts and paid conversion rates at 7, 30 and 60 days. Only mature cohorts have rates.';
