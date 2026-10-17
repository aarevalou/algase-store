alter table public.products
  add column if not exists colors jsonb not null default '[]'::jsonb;

alter table public.products
  drop constraint if exists products_category_id_fkey;
alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete cascade;

alter table public.inventory_movements
  alter column variant_id drop not null;
alter table public.inventory_movements
  drop constraint if exists inventory_movements_variant_id_fkey;
alter table public.inventory_movements
  add constraint inventory_movements_variant_id_fkey
  foreign key (variant_id) references public.product_variants(id) on delete set null;

create sequence public.store_request_number_seq start 1000;

create table public.store_requests (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('public.store_request_number_seq'),
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation','confirmed','in_production','ready','shipped','delivered','cancelled')),
  total_clp numeric(12,0) not null check (total_clp >= 0),
  created_at timestamptz not null default now(),
  contact jsonb not null,
  fulfillment public.fulfillment_method not null,
  address jsonb,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0)
);

create index store_requests_created_at_idx on public.store_requests (created_at desc);
create index store_requests_user_id_idx on public.store_requests (user_id, created_at desc);

alter table public.store_requests enable row level security;

create policy store_requests_owner_read on public.store_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy store_requests_admin_update on public.store_requests
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy store_requests_admin_delete on public.store_requests
  for delete to authenticated
  using (public.is_admin());

grant select, update, delete on public.store_requests to authenticated;
revoke insert on public.store_requests from anon, authenticated;

create or replace function public.submit_store_request(p_request jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.store_requests%rowtype;
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

  insert into public.store_requests (
    user_id, total_clp, contact, fulfillment, address, items
  ) values (
    auth.uid(),
    (p_request->>'total_clp')::numeric,
    p_request->'contact',
    (p_request->>'fulfillment')::public.fulfillment_method,
    case when p_request->>'fulfillment' = 'shipping' then p_request->'address' end,
    p_request->'items'
  ) returning * into v_request;

  return to_jsonb(v_request);
end
$$;

revoke all on function public.submit_store_request(jsonb) from public;
grant execute on function public.submit_store_request(jsonb) to anon, authenticated;

create or replace function public.admin_save_product(p_product jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_category_id uuid;
  v_image jsonb;
  v_variant jsonb;
begin
  if not public.is_admin() then raise exception 'Se requiere rol administrador'; end if;

  select id into v_category_id
    from public.categories
   where slug = p_product->'category'->>'slug' and is_active;
  if v_category_id is null then raise exception 'La categoría no existe o está inactiva'; end if;

  v_product_id := coalesce(nullif(p_product->>'id', '')::uuid, gen_random_uuid());

  insert into public.products (
    id, category_id, slug, name, description, base_price_clp,
    customizable, customization_fee_clp, is_featured, colors
  ) values (
    v_product_id,
    v_category_id,
    p_product->>'slug',
    p_product->>'name',
    p_product->>'description',
    (p_product->>'base_price_clp')::numeric,
    coalesce((p_product->>'customizable')::boolean, true),
    coalesce((p_product->>'customization_fee_clp')::numeric, 0),
    coalesce((p_product->>'is_featured')::boolean, false),
    coalesce(p_product->'colors', '[]'::jsonb)
  )
  on conflict (id) do update set
    category_id = excluded.category_id,
    slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    base_price_clp = excluded.base_price_clp,
    customizable = excluded.customizable,
    customization_fee_clp = excluded.customization_fee_clp,
    is_featured = excluded.is_featured,
    colors = excluded.colors,
    is_active = true;

  delete from public.product_images where product_id = v_product_id;
  for v_image in select value from jsonb_array_elements(coalesce(p_product->'images', '[]'::jsonb)) loop
    insert into public.product_images (product_id, path, alt, sort_order)
    values (
      v_product_id,
      v_image->>'path',
      v_image->>'alt',
      coalesce((v_image->>'sort_order')::integer, 0)
    );
  end loop;

  for v_variant in select value from jsonb_array_elements(coalesce(p_product->'variants', '[]'::jsonb)) loop
    insert into public.product_variants (id, product_id, sku, size, color, price_clp)
    values (
      coalesce(nullif(v_variant->>'id', '')::uuid, gen_random_uuid()),
      v_product_id,
      v_variant->>'sku',
      v_variant->>'size',
      v_variant->>'color',
      nullif(v_variant->>'price_clp', '')::numeric
    )
    on conflict (sku) do update set
      product_id = excluded.product_id,
      size = excluded.size,
      color = excluded.color,
      price_clp = excluded.price_clp,
      is_active = true;
  end loop;

  return v_product_id;
end
$$;

revoke all on function public.admin_save_product(jsonb) from public, anon;
grant execute on function public.admin_save_product(jsonb) to authenticated;
