-- Move a completed shopping-list item into household inventory atomically.
-- Inventory upsert and shopping-item deletion are committed in one transaction.
create or replace function public.move_purchased_item_to_inventory(
  p_share_code text,
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list_id uuid;
  v_name text;
  v_quantity integer;
  v_category text;
begin
  select l.id, i.name, i.quantity, i.category
    into v_list_id, v_name, v_quantity, v_category
  from public.family_lists l
  join public.family_items i on i.list_id = l.id
  where l.share_code = upper(trim(coalesce(p_share_code, '')))
    and i.id = p_item_id
    and i.done = true
  for update of i;

  if not found then
    raise exception 'Artigo comprado não encontrado.';
  end if;

  perform public.add_family_inventory_item(
    p_share_code,
    v_name,
    greatest(1, least(coalesce(v_quantity, 1), 999)),
    case when v_category in ('fruta','frescos','despensa','limpeza','outros') then v_category else 'outros' end,
    case when v_category = 'frescos' then 'frigorifico' else 'despensa' end,
    null
  );

  delete from public.family_items
  where id = p_item_id and list_id = v_list_id and done = true;

  if not found then
    raise exception 'Não foi possível retirar o artigo da lista de compras.';
  end if;

  return public.family_list_payload(v_list_id);
end;
$$;

revoke all on function public.move_purchased_item_to_inventory(text, uuid) from public, anon, authenticated;
grant execute on function public.move_purchased_item_to_inventory(text, uuid) to anon, authenticated;
