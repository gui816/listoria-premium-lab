-- Listora household inventory foundation.
-- Inventory is family-list scoped and uses the existing share-code RPC access model.

create table if not exists public.family_inventory_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.family_lists(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  normalized_name text not null,
  quantity integer not null default 1 check (quantity between 0 and 999),
  category text not null default 'outros' check (category in ('fruta','frescos','despensa','limpeza','outros')),
  storage_location text not null default 'despensa' check (storage_location in ('frigorifico','congelador','despensa','outro')),
  expiry_date date,
  restock_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, normalized_name)
);

create index if not exists family_inventory_list_updated_idx
  on public.family_inventory_items (list_id, updated_at desc);

create table if not exists public.family_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.family_lists(id) on delete cascade,
  inventory_item_id uuid references public.family_inventory_items(id) on delete set null,
  movement_type text not null check (movement_type in ('entry','consumption','adjustment','restock_request')),
  quantity_delta integer not null,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table public.family_inventory_items enable row level security;
alter table public.family_inventory_movements enable row level security;
revoke all on public.family_inventory_items from anon, authenticated;
revoke all on public.family_inventory_movements from anon, authenticated;

create or replace function public.family_inventory_payload(p_list_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id::text, 'name', i.name, 'quantity', i.quantity, 'category', i.category,
      'storage_location', i.storage_location, 'expiry_date', i.expiry_date,
      'restock_requested_at', i.restock_requested_at, 'updated_at', i.updated_at
    ) order by i.name)
    from public.family_inventory_items i where i.list_id = p_list_id
  ), '[]'::jsonb));
$$;

create or replace function public.get_family_inventory(p_share_code text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select public.family_inventory_payload(l.id)
  from public.family_lists l
  where l.share_code = upper(trim(coalesce(p_share_code, '')))
    and l.share_code ~ '^[0-9A-F]{12}$';
$$;

create or replace function public.add_family_inventory_item(
  p_share_code text, p_name text, p_quantity integer default 1,
  p_category text default 'outros', p_storage_location text default 'despensa',
  p_expiry_date date default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_list_id uuid;
  v_name text := left(trim(coalesce(p_name, '')), 100);
  v_quantity integer := greatest(1, least(coalesce(p_quantity, 1), 999));
  v_category text := case when p_category in ('fruta','frescos','despensa','limpeza','outros') then p_category else 'outros' end;
  v_location text := case when p_storage_location in ('frigorifico','congelador','despensa','outro') then p_storage_location else 'despensa' end;
  v_item_id uuid;
begin
  select id into v_list_id from public.family_lists where share_code = upper(trim(coalesce(p_share_code, '')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  if v_name = '' then raise exception 'Indica o nome do produto.'; end if;
  insert into public.family_inventory_items(list_id,name,normalized_name,quantity,category,storage_location,expiry_date)
  values (v_list_id,v_name,lower(regexp_replace(v_name,'\s+',' ','g')),v_quantity,v_category,v_location,p_expiry_date)
  on conflict (list_id,normalized_name) do update set
    quantity = least(999, public.family_inventory_items.quantity + excluded.quantity),
    category = excluded.category, storage_location = excluded.storage_location,
    expiry_date = coalesce(excluded.expiry_date, public.family_inventory_items.expiry_date),
    restock_requested_at = null, updated_at = now()
  returning id into v_item_id;
  insert into public.family_inventory_movements(list_id,inventory_item_id,movement_type,quantity_delta,source)
  values(v_list_id,v_item_id,'entry',v_quantity,'manual');
  return public.family_inventory_payload(v_list_id);
end;
$$;

create or replace function public.update_family_inventory_item(p_share_code text,p_item_id uuid,p_quantity integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_list_id uuid; v_delta integer; v_old integer;
begin
  select id into v_list_id from public.family_lists where share_code = upper(trim(coalesce(p_share_code,'')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  select quantity into v_old from public.family_inventory_items where id=p_item_id and list_id=v_list_id;
  if not found then raise exception 'Produto não encontrado.'; end if;
  update public.family_inventory_items set quantity=greatest(0,least(coalesce(p_quantity,0),999)),updated_at=now()
  where id=p_item_id and list_id=v_list_id returning quantity into v_delta;
  insert into public.family_inventory_movements(list_id,inventory_item_id,movement_type,quantity_delta,source)
  values(v_list_id,p_item_id,case when v_delta < v_old then 'consumption' else 'adjustment' end,v_delta-v_old,'manual');
  return public.family_inventory_payload(v_list_id);
end;
$$;

create or replace function public.delete_family_inventory_item(p_share_code text,p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_list_id uuid;
begin
  select id into v_list_id from public.family_lists where share_code=upper(trim(coalesce(p_share_code,'')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  delete from public.family_inventory_items where id=p_item_id and list_id=v_list_id;
  if not found then raise exception 'Produto não encontrado.'; end if;
  return public.family_inventory_payload(v_list_id);
end;
$$;

create or replace function public.record_inventory_restock_request(p_share_code text,p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_list_id uuid;
begin
  select id into v_list_id from public.family_lists where share_code=upper(trim(coalesce(p_share_code,'')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  update public.family_inventory_items set restock_requested_at=now(),updated_at=now()
  where id=p_item_id and list_id=v_list_id;
  if not found then raise exception 'Produto não encontrado.'; end if;
  insert into public.family_inventory_movements(list_id,inventory_item_id,movement_type,quantity_delta,source)
  values(v_list_id,p_item_id,'restock_request',0,'shopping_list');
  return public.family_inventory_payload(v_list_id);
end;
$$;

revoke all on function public.family_inventory_payload(uuid) from public,anon,authenticated;
revoke all on function public.get_family_inventory(text) from public,anon,authenticated;
revoke all on function public.add_family_inventory_item(text,text,integer,text,text,date) from public,anon,authenticated;
revoke all on function public.update_family_inventory_item(text,uuid,integer) from public,anon,authenticated;
revoke all on function public.delete_family_inventory_item(text,uuid) from public,anon,authenticated;
revoke all on function public.record_inventory_restock_request(text,uuid) from public,anon,authenticated;

grant execute on function public.get_family_inventory(text) to anon,authenticated;
grant execute on function public.add_family_inventory_item(text,text,integer,text,text,date) to anon,authenticated;
grant execute on function public.update_family_inventory_item(text,uuid,integer) to anon,authenticated;
grant execute on function public.delete_family_inventory_item(text,uuid) to anon,authenticated;
grant execute on function public.record_inventory_restock_request(text,uuid) to anon,authenticated;
