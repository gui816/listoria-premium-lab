-- Listora account foundation: anonymous sessions, permanent accounts and profiles.
-- Apply after the existing schema migrations.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  country_code text references public.countries(code),
  age integer check (age is null or age between 13 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from anon;
grant select, insert, update on public.user_profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.user_profiles;
create policy "Users can read their own profile"
on public.user_profiles for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can create their own profile" on public.user_profiles;
create policy "Users can create their own profile"
on public.user_profiles for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
on public.user_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.set_user_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_user_profile_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles(user_id, display_name, country_code, age)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', '')), 60), ''),
    nullif(upper(trim(coalesce(new.raw_user_meta_data ->> 'country_code', ''))), ''),
    case
      when coalesce(new.raw_user_meta_data ->> 'age', '') ~ '^[0-9]{1,3}$'
      then (new.raw_user_meta_data ->> 'age')::integer
      else null
    end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Existing anonymous sessions are intentionally supported. Their profile row
-- is created automatically and can be upgraded to a permanent identity later.
