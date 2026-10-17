alter table public.orders
  add column if not exists contact_rut text;

create or replace function public.create_checkout_order(
  p_items jsonb,
  p_fulfillment public.fulfillment_method,
  p_address jsonb,
  p_contact jsonb,
  p_idempotency_key uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
begin
  if v_user_id is null then
    raise exception 'Inicia sesión para realizar una compra';
  end if;
  if nullif(trim(p_contact->>'rut'), '') is null then
    raise exception 'El RUT es obligatorio para realizar una compra';
  end if;

  v_order_id := public.create_order(
    p_items,
    p_fulfillment,
    p_address,
    p_contact,
    p_idempotency_key
  );

  update public.orders
     set contact_rut = trim(p_contact->>'rut')
   where id = v_order_id and user_id = v_user_id;

  return v_order_id;
end
$$;

revoke all on function public.create_checkout_order(jsonb, public.fulfillment_method, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.create_checkout_order(jsonb, public.fulfillment_method, jsonb, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
