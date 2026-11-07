-- Local/development Premium simulation when Stripe is not configured.
-- Kept separate from Stripe-backed subscriptions so demo entitlements can never be mistaken for paid subscriptions.
create table if not exists public.premium_demo_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','past_due','canceled','unpaid')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end boolean not null default false,
  past_due_grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.premium_demo_subscriptions enable row level security;
revoke all on public.premium_demo_subscriptions from public, anon, authenticated;
