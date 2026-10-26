-- Lista Família initial schema and secure RPC API.
-- Run this entire file in the Supabase SQL Editor.

create table if not exists public.family_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  share_code text not null unique check (share_code ~ '^[0-9A-F]{12}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.family_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.family_lists(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  quantity integer not null default 1 check (quantity between 1 and 999),
  category text not null default 'outros' check (category in ('fruta','frescos','despensa','limpeza','outros')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists family_items_list_created_idx
  on public.family_items (list_id, created_at);

alter table public.family_lists enable row level security;
alter table public.family_items enable row level security;
revoke all on public.family_lists from anon, authenticated;
revoke all on public.family_items from anon, authenticated;

create or replace function public.family_list_payload(p_list_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'list', jsonb_build_object('name', l.name, 'shareCode', l.share_code),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', i.id::text,
        'name', i.name,
        'quantity', i.quantity,
        'category', i.category,
        'done', i.done,
        'createdAt', i.created_at
      ) order by i.created_at, i.id)
      from public.family_items i where i.list_id = l.id
    ), '[]'::jsonb)
  )
  from public.family_lists l
  where l.id = p_list_id;
$$;

create or replace function public.create_family_list(p_name text default 'Compras da família')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(trim(coalesce(p_name, '')), 60);
  v_code text;
  v_id uuid;
begin
  if v_name = '' then v_name := 'Compras da família'; end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (select 1 from public.family_lists where share_code = v_code);
  end loop;
  insert into public.family_lists(name, share_code)
  values (v_name, v_code)
  returning id into v_id;
  return public.family_list_payload(v_id);
end;
$$;

create or replace function public.get_family_list(p_share_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.family_list_payload(l.id)
  from public.family_lists l
  where l.share_code = upper(trim(coalesce(p_share_code, '')))
    and l.share_code ~ '^[0-9A-F]{12}$';
$$;

create or replace function public.add_family_item(
  p_share_code text, p_name text, p_quantity integer default 1, p_category text default 'outros'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list_id uuid;
  v_name text := left(trim(coalesce(p_name, '')), 100);
  v_quantity integer := greatest(1, least(coalesce(p_quantity, 1), 999));
  v_category text := coalesce(p_category, 'outros');
begin
  select id into v_list_id from public.family_lists
  where share_code = upper(trim(coalesce(p_share_code, '')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  if v_name = '' then raise exception 'Indica o nome do artigo.'; end if;
  if v_category not in ('fruta','frescos','despensa','limpeza','outros') then v_category := 'outros'; end if;
  insert into public.family_items(list_id, name, quantity, category)
  values (v_list_id, v_name, v_quantity, v_category);
  return public.family_list_payload(v_list_id);
end;
$$;

create or replace function public.update_family_item(
  p_share_code text, p_item_id uuid, p_done boolean default null,
  p_name text default null, p_quantity integer default null, p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list_id uuid;
  v_name text;
  v_category text;
begin
  select id into v_list_id from public.family_lists
  where share_code = upper(trim(coalesce(p_share_code, '')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  if p_name is not null then
    v_name := left(trim(p_name), 100);
    if v_name = '' then raise exception 'O nome não pode ficar vazio.'; end if;
  end if;
  if p_category is not null then
    v_category := case when p_category in ('fruta','frescos','despensa','limpeza','outros') then p_category else 'outros' end;
  end if;
  update public.family_items
  set done = coalesce(p_done, done),
      name = coalesce(v_name, name),
      quantity = case when p_quantity is null then quantity else greatest(1, least(p_quantity, 999)) end,
      category = coalesce(v_category, category)
  where id = p_item_id and list_id = v_list_id;
  if not found then raise exception 'Artigo não encontrado.'; end if;
  return public.family_list_payload(v_list_id);
end;
$$;

create or replace function public.delete_family_item(p_share_code text, p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_list_id uuid;
begin
  select id into v_list_id from public.family_lists
  where share_code = upper(trim(coalesce(p_share_code, '')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  delete from public.family_items where id = p_item_id and list_id = v_list_id;
  if not found then raise exception 'Artigo não encontrado.'; end if;
  return public.family_list_payload(v_list_id);
end;
$$;

create or replace function public.clear_completed_items(p_share_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_list_id uuid;
begin
  select id into v_list_id from public.family_lists
  where share_code = upper(trim(coalesce(p_share_code, '')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  delete from public.family_items where list_id = v_list_id and done = true;
  return public.family_list_payload(v_list_id);
end;
$$;

revoke all on function public.family_list_payload(uuid) from public, anon, authenticated;
revoke all on function public.create_family_list(text) from public, anon, authenticated;
revoke all on function public.get_family_list(text) from public, anon, authenticated;
revoke all on function public.add_family_item(text, text, integer, text) from public, anon, authenticated;
revoke all on function public.update_family_item(text, uuid, boolean, text, integer, text) from public, anon, authenticated;
revoke all on function public.delete_family_item(text, uuid) from public, anon, authenticated;
revoke all on function public.clear_completed_items(text) from public, anon, authenticated;

grant execute on function public.create_family_list(text) to anon, authenticated;
grant execute on function public.get_family_list(text) to anon, authenticated;
grant execute on function public.add_family_item(text, text, integer, text) to anon, authenticated;
grant execute on function public.update_family_item(text, uuid, boolean, text, integer, text) to anon, authenticated;
grant execute on function public.delete_family_item(text, uuid) to anon, authenticated;
grant execute on function public.clear_completed_items(text) to anon, authenticated;
