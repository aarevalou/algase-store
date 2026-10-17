begin;

alter table public.products
  add column if not exists catalog_image_path text;

create or replace function public.admin_set_product_catalog_image(
  p_product_id uuid,
  p_path text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Se requiere rol administrador';
  end if;

  update public.products
     set catalog_image_path = nullif(trim(p_path), '')
   where id = p_product_id and is_active;

  if not found then
    raise exception 'No se encontró el producto activo';
  end if;
end
$$;

revoke all on function public.admin_set_product_catalog_image(uuid, text)
  from public, anon;
grant execute on function public.admin_set_product_catalog_image(uuid, text)
  to authenticated;

update public.products product
set catalog_image_path = (
  select path
  from public.product_images
  where product_id = product.id
  order by sort_order, id
  limit 1
)
where product.catalog_image_path is null
  and exists (
    select 1
    from public.product_images
    where product_id = product.id
  );

notify pgrst, 'reload schema';

commit;