-- Shared members and private receipt archive for Listora.
-- Run this migration in the Supabase SQL Editor after the initial schema.

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.family_lists(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 16 and 100),
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, device_id)
);

create table if not exists public.family_receipts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.family_lists(id) on delete cascade,
  member_id uuid not null references public.family_members(id) on delete restrict,
  store_name text not null check (char_length(store_name) between 1 and 120),
  purchased_at date not null default current_date,
  total numeric(10,2) not null check (total >= 0),
  notes text not null default '' check (char_length(notes) <= 1000),
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);
create index if not exists family_receipts_list_date_idx
  on public.family_receipts (list_id, purchased_at desc, created_at desc);

alter table public.family_members enable row level security;
alter table public.family_receipts enable row level security;
revoke all on public.family_members from anon, authenticated;
revoke all on public.family_receipts from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-receipts', 'family-receipts', false, 10485760,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- The share code is the existing invite secret. Receipt objects are private and
-- stored under <share_code>/<receipt_uuid>/<filename>.
create or replace function public.receipt_share_code_exists(p_code text)
returns boolean language sql stable security definer set search_path = ''
as $
  select exists (select 1 from public.family_lists where share_code = p_code);
$;
revoke all on function public.receipt_share_code_exists(text) from public, anon, authenticated;
grant execute on function public.receipt_share_code_exists(text) to anon, authenticated;

drop policy if exists "List members can read receipt files" on storage.objects;
create policy "List members can read receipt files"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'family-receipts'
  and public.receipt_share_code_exists(split_part(name, '/', 1))
);
drop policy if exists "List members can upload receipt files" on storage.objects;
create policy "List members can upload receipt files"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'family-receipts'
  and public.receipt_share_code_exists(split_part(name, '/', 1))
);
drop policy if exists "List members can delete receipt files" on storage.objects;
create policy "List members can delete receipt files"
on storage.objects for delete to anon, authenticated
using (
  bucket_id = 'family-receipts'
  and public.receipt_share_code_exists(split_part(name, '/', 1))
);

create or replace function public.family_list_payload(p_list_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'list', jsonb_build_object('name', l.name, 'shareCode', l.share_code),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        '_id', i.id::text, 'name', i.name, 'quantity', i.quantity,
        'category', i.category, 'done', i.done, 'createdAt', i.created_at
      ) order by i.created_at, i.id)
      from public.family_items i where i.list_id = l.id
    ), '[]'::jsonb),
    'receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id::text, 'storeName', r.store_name, 'purchasedAt', r.purchased_at,
        'total', r.total, 'notes', r.notes, 'filePath', r.file_path,
        'fileName', r.file_name, 'createdAt', r.created_at,
        'memberName', m.display_name
      ) order by r.purchased_at desc, r.created_at desc)
      from public.family_receipts r
      join public.family_members m on m.id = r.member_id
      where r.list_id = l.id
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id::text, 'displayName', m.display_name)
                       order by m.created_at)
      from public.family_members m where m.list_id = l.id
    ), '[]'::jsonb)
  )
  from public.family_lists l where l.id = p_list_id;
$$;

create or replace function public.register_family_member(
  p_share_code text, p_device_id text, p_display_name text
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_list_id uuid; v_member_id uuid; v_name text := left(trim(coalesce(p_display_name,'')),60);
begin
  select id into v_list_id from public.family_lists
  where share_code = upper(trim(coalesce(p_share_code,'')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  if coalesce(length(trim(p_device_id)),0) < 16 or length(p_device_id) > 100 then
    raise exception 'Identificador do dispositivo inválido.';
  end if;
  if v_name = '' then raise exception 'Indica o teu nome.'; end if;
  insert into public.family_members(list_id, device_id, display_name)
  values (v_list_id, p_device_id, v_name)
  on conflict (list_id, device_id) do update
    set display_name = excluded.display_name, updated_at = now()
  returning id into v_member_id;
  return jsonb_build_object('id',v_member_id::text,'displayName',v_name);
end;
$$;

create or replace function public.add_family_receipt(
  p_share_code text, p_device_id text, p_store_name text, p_purchased_at date,
  p_total numeric, p_notes text default '', p_file_path text default null, p_file_name text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_list_id uuid; v_member_id uuid; v_id uuid;
begin
  select id into v_list_id from public.family_lists
  where share_code = upper(trim(coalesce(p_share_code,'')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  select id into v_member_id from public.family_members
  where list_id = v_list_id and device_id = p_device_id;
  if v_member_id is null then raise exception 'Regista o teu nome antes de adicionares uma fatura.'; end if;
  if trim(coalesce(p_store_name,'')) = '' then raise exception 'Indica o supermercado.'; end if;
  if p_total is null or p_total < 0 then raise exception 'Indica um total válido.'; end if;
  if p_file_path is not null and split_part(p_file_path,'/',1) <> upper(trim(p_share_code)) then
    raise exception 'O comprovativo não pertence a esta lista.';
  end if;
  insert into public.family_receipts(list_id,member_id,store_name,purchased_at,total,notes,file_path,file_name)
  values (v_list_id,v_member_id,left(trim(p_store_name),120),coalesce(p_purchased_at,current_date),
          p_total,left(coalesce(p_notes,''),1000),p_file_path,left(p_file_name,255))
  returning id into v_id;
  return public.family_list_payload(v_list_id);
end;
$$;

create or replace function public.delete_family_receipt(p_share_code text, p_receipt_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_list_id uuid; v_path text;
begin
  select id into v_list_id from public.family_lists
  where share_code = upper(trim(coalesce(p_share_code,'')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  select file_path into v_path from public.family_receipts
  where id = p_receipt_id and list_id = v_list_id;
  if not found then raise exception 'Fatura não encontrada.'; end if;
  delete from public.family_receipts where id = p_receipt_id and list_id = v_list_id;
  return jsonb_build_object('filePath',v_path,'payload',public.family_list_payload(v_list_id));
end;
$$;

revoke all on function public.family_list_payload(uuid) from public, anon, authenticated;
revoke all on function public.register_family_member(text,text,text) from public, anon, authenticated;
revoke all on function public.add_family_receipt(text,text,text,date,numeric,text,text,text) from public, anon, authenticated;
revoke all on function public.delete_family_receipt(text,uuid) from public, anon, authenticated;
grant execute on function public.register_family_member(text,text,text) to anon, authenticated;
grant execute on function public.add_family_receipt(text,text,text,date,numeric,text,text,text) to anon, authenticated;
grant execute on function public.delete_family_receipt(text,uuid) to anon, authenticated;
