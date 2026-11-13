-- Add a batch of captured products to household inventory in one transaction.
create or replace function public.add_family_inventory_items(
  p_share_code text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list_id uuid;
  v_item jsonb;
  v_name text;
  v_quantity integer;
  v_category text;
  v_storage text;
begin
  select id into v_list_id
  from public.family_lists
  where share_code = upper(trim(coalesce(p_share_code, '')));
  if v_list_id is null then raise exception 'Lista não encontrada.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 60 then
    raise exception 'A lista de produtos é inválida ou excede o limite permitido.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_name := left(trim(coalesce(v_item->>'name', '')), 100);
    if v_name = '' then raise exception 'Todos os produtos precisam de um nome.'; end if;
    v_quantity := greatest(1, least(coalesce(nullif(v_item->>'quantity', '')::integer, 1), 999));
    v_category := case when v_item->>'category' in ('fruta','frescos','despensa','limpeza','outros') then v_item->>'category' else 'outros' end;
    v_storage := case when v_item->>'storage_location' in ('frigorifico','congelador','despensa','outro') then v_item->>'storage_location' else 'despensa' end;
    perform public.add_family_inventory_item(p_share_code, v_name, v_quantity, v_category, v_storage, null);
  end loop;
  return public.family_inventory_payload(v_list_id);
end;
$$;

revoke all on function public.add_family_inventory_items(text, jsonb) from public, anon, authenticated;
grant execute on function public.add_family_inventory_items(text, jsonb) to anon, authenticated;
