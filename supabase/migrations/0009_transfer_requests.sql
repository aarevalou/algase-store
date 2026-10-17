alter table public.store_requests
  add column if not exists payment_method text not null default 'quote'
  check (payment_method in ('quote', 'transfer'));

create or replace function public.submit_store_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.store_requests%rowtype;
  v_payment_method text := coalesce(p_request->>'payment_method', 'quote');
begin
  if jsonb_typeof(p_request->'contact') is distinct from 'object'
     or nullif(trim(p_request#>>'{contact,name}'), '') is null
     or nullif(trim(p_request#>>'{contact,email}'), '') is null
     or nullif(trim(p_request#>>'{contact,phone}'), '') is null then
    raise exception 'Datos de contacto incompletos';
  end if;
  if jsonb_typeof(p_request->'items') is distinct from 'array' then
    raise exception 'Los artículos de la solicitud no son válidos';
  end if;
  if jsonb_array_length(p_request->'items') = 0 then
    raise exception 'La solicitud debe incluir al menos un artículo';
  end if;
  if coalesce((p_request->>'total_clp')::numeric, -1) < 0 then
    raise exception 'El total de referencia no es válido';
  end if;
  if p_request->>'fulfillment' = 'shipping'
     and jsonb_typeof(p_request->'address') <> 'object' then
    raise exception 'Falta la dirección de despacho';
  end if;
  if v_payment_method not in ('quote', 'transfer') then
    raise exception 'El método de pago de la solicitud no es válido';
  end if;

  insert into public.store_requests (
    user_id, total_clp, contact, fulfillment, address, items, payment_method
  ) values (
    auth.uid(),
    (p_request->>'total_clp')::numeric,
    p_request->'contact',
    (p_request->>'fulfillment')::public.fulfillment_method,
    case when p_request->>'fulfillment' = 'shipping' then p_request->'address' end,
    p_request->'items',
    v_payment_method
  ) returning * into v_request;

  return to_jsonb(v_request);
end
$$;

notify pgrst, 'reload schema';