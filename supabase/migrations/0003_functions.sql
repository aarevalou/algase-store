-- Algase · Reglas de negocio críticas en la base de datos (atómicas, no manipulables desde el cliente).

-- Crea un pedido calculando TODOS los precios en el servidor y reservando stock.
-- p_items: [{ "variant_id": uuid, "quantity": int, "customization": { "placement","text","file_path","notes" } | null }]
create or replace function public.create_order(
  p_items jsonb,
  p_fulfillment public.fulfillment_method,
  p_address jsonb,
  p_contact jsonb,            -- { "name","email","phone" }
  p_idempotency_key uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_order uuid;
  v_item jsonb;
  v_qty int;
  v_v record;
  v_unit numeric(12,0);
  v_fee numeric(12,0);
  v_line numeric(12,0);
  v_item_id uuid;
  v_subtotal numeric(12,0) := 0;
  v_shipping numeric(12,0) := 0;
begin
  if v_user is null then raise exception 'Se requiere iniciar sesión'; end if;

  select id into v_order from orders where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then return v_order; end if;   -- solicitud repetida: mismo pedido

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if coalesce(trim(p_contact->>'name'),'') = '' or coalesce(trim(p_contact->>'email'),'') = ''
     or coalesce(trim(p_contact->>'phone'),'') = '' then
    raise exception 'Datos de contacto incompletos';
  end if;

  if p_fulfillment = 'shipping' then
    select coalesce((value #>> '{}')::numeric, 0) into v_shipping from site_settings where key = 'shipping_flat_clp';
    v_shipping := coalesce(v_shipping, 0);
  end if;

  insert into orders (user_id, fulfillment, contact_name, contact_email, contact_phone, shipping_address,
                      subtotal_clp, shipping_clp, total_clp, idempotency_key)
  values (v_user, p_fulfillment, p_contact->>'name', p_contact->>'email', p_contact->>'phone',
          case when p_fulfillment = 'shipping' then p_address end, 0, v_shipping, v_shipping, p_idempotency_key)
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'Cantidad inválida'; end if;

    select v.id, v.sku, p.name as pname, p.customizable, p.customization_fee_clp,
           concat_ws(' / ', v.size, v.color) as label,
           coalesce(v.price_clp, p.base_price_clp) as price
      into v_v
      from product_variants v join products p on p.id = v.product_id
     where v.id = (v_item->>'variant_id')::uuid and v.is_active and p.is_active;
    if not found then raise exception 'Producto no disponible'; end if;

    -- Reserva atómica: falla si no hay stock suficiente
    update inventory set reserved = reserved + v_qty
     where variant_id = v_v.id and on_hand - reserved >= v_qty;
    if not found then raise exception 'Stock insuficiente para %', v_v.pname; end if;

    v_unit := v_v.price;
    v_fee  := case when v_v.customizable and (v_item->'customization') is not null
                        and jsonb_typeof(v_item->'customization') = 'object'
                   then v_v.customization_fee_clp else 0 end;
    v_line := (v_unit + v_fee) * v_qty;
    v_subtotal := v_subtotal + v_line;

    insert into order_items (order_id, variant_id, product_name, variant_label, sku,
                             unit_price_clp, customization_fee_clp, quantity, line_total_clp)
    values (v_order, v_v.id, v_v.pname, v_v.label, v_v.sku, v_unit, v_fee, v_qty, v_line)
    returning id into v_item_id;

    if jsonb_typeof(v_item->'customization') = 'object' then
      insert into order_item_customizations (order_item_id, placement, text_content, file_path, notes)
      values (v_item_id,
              left(v_item#>>'{customization,placement}', 40),
              left(v_item#>>'{customization,text}', 300),
              -- el archivo debe estar bajo la carpeta del propio usuario
              case when (v_item#>>'{customization,file_path}') like v_user::text || '/%'
                   then v_item#>>'{customization,file_path}' end,
              left(v_item#>>'{customization,notes}', 500));
    end if;
  end loop;

  update orders set subtotal_clp = v_subtotal, total_clp = v_subtotal + v_shipping where id = v_order;
  return v_order;
end $$;
revoke all on function public.create_order(jsonb, public.fulfillment_method, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.create_order(jsonb, public.fulfillment_method, jsonb, jsonb, uuid) to authenticated;

-- Aplica el resultado de un pago YA VERIFICADO con el proveedor. Idempotente.
-- Solo service_role (Edge Functions). Valida que el monto confirmado coincida con el pedido.
create or replace function public.apply_payment_result(
  p_payment_id uuid,
  p_status public.payment_status,
  p_external_id text,
  p_amount_clp numeric,
  p_raw jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_pay payments%rowtype;
  v_it record;
begin
  select * into v_pay from payments where id = p_payment_id for update;
  if not found then raise exception 'Pago no existe'; end if;
  if v_pay.status in ('paid','refunded','partially_refunded') then return; end if;  -- ya procesado

  if p_status = 'paid' and p_amount_clp is distinct from v_pay.amount_clp then
    raise exception 'Monto confirmado (%) distinto al esperado (%)', p_amount_clp, v_pay.amount_clp;
  end if;

  update payments set status = p_status, external_id = coalesce(p_external_id, external_id),
         raw_response = p_raw, paid_at = case when p_status = 'paid' then now() end
   where id = p_payment_id;

  if p_status = 'paid' then
    update orders set status = 'confirmed' where id = v_pay.order_id and status = 'pending_payment';
    for v_it in select variant_id, quantity from order_items where order_id = v_pay.order_id and variant_id is not null loop
      update inventory set on_hand = on_hand - v_it.quantity, reserved = reserved - v_it.quantity
       where variant_id = v_it.variant_id;
      insert into inventory_movements (variant_id, delta, reason, order_id)
      values (v_it.variant_id, -v_it.quantity, 'sale', v_pay.order_id);
    end loop;
  elsif p_status in ('failed','cancelled') then
    -- Libera la reserva solo si no quedan otros pagos pendientes del mismo pedido
    if not exists (select 1 from payments where order_id = v_pay.order_id and id <> p_payment_id and status = 'pending') then
      update orders set status = 'cancelled' where id = v_pay.order_id and status = 'pending_payment';
      for v_it in select variant_id, quantity from order_items where order_id = v_pay.order_id and variant_id is not null loop
        update inventory set reserved = greatest(reserved - v_it.quantity, 0) where variant_id = v_it.variant_id;
      end loop;
    end if;
  end if;

  insert into audit_log (action, entity, entity_id, details)
  values ('payment.' || p_status, 'payment', p_payment_id::text, jsonb_build_object('order_id', v_pay.order_id));
end $$;
revoke all on function public.apply_payment_result(uuid, public.payment_status, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_result(uuid, public.payment_status, text, numeric, jsonb) to service_role;
