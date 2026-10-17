-- Polerones y poleras de algodón de fabricación propia.
insert into public.categories (slug, name, sort_order)
values ('poleras', 'Poleras', 1), ('polerones', 'Polerones', 2)
on conflict (slug) do update set name = excluded.name;

with product_data (category_slug, slug, name, description, base_price_clp) as (
  values
    ('polerones', 'poleron-algodon', 'Polerón de algodón',
     'Polerón de algodón de fabricación propia, listo para personalizar con estampados, frases o diseños. Consulta por colores disponibles y envíanos tu idea.', 10000),
    ('poleras', 'polera-algodon', 'Polera de algodón',
     'Polera de algodón de fabricación propia, ideal para estampados personalizados, frases, ilustraciones o identidad de marca. Consulta por colores disponibles y envíanos tu idea.', 6000)
)
insert into public.products (category_id, slug, name, description, base_price_clp, customizable, customization_fee_clp, is_featured)
select c.id, d.slug, d.name, d.description, d.base_price_clp, true, 0, true
from product_data d join public.categories c on c.slug = d.category_slug
on conflict (slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  base_price_clp = excluded.base_price_clp,
  customizable = excluded.customizable,
  customization_fee_clp = excluded.customization_fee_clp,
  is_featured = excluded.is_featured;

with variant_data (product_slug, size, price_clp, sku) as (
  values
    ('poleron-algodon', '2', 10000, 'POLERON-ALG-02'),
    ('poleron-algodon', '4', 10000, 'POLERON-ALG-04'),
    ('poleron-algodon', '6', 10000, 'POLERON-ALG-06'),
    ('poleron-algodon', '8', 12000, 'POLERON-ALG-08'),
    ('poleron-algodon', '10', 12000, 'POLERON-ALG-10'),
    ('poleron-algodon', '12', 13000, 'POLERON-ALG-12'),
    ('poleron-algodon', '14', 14000, 'POLERON-ALG-14'),
    ('poleron-algodon', '16', 15000, 'POLERON-ALG-16'),
    ('poleron-algodon', 'S', 17000, 'POLERON-ALG-S'),
    ('poleron-algodon', 'M', 17000, 'POLERON-ALG-M'),
    ('poleron-algodon', 'L', 17000, 'POLERON-ALG-L'),
    ('poleron-algodon', 'XL', 18000, 'POLERON-ALG-XL'),
    ('poleron-algodon', '2XL', 18000, 'POLERON-ALG-2XL'),
    ('poleron-algodon', '3XL', 19000, 'POLERON-ALG-3XL'),
    ('poleron-algodon', '4XL', 19000, 'POLERON-ALG-4XL'),
    ('poleron-algodon', '5XL', 20000, 'POLERON-ALG-5XL'),
    ('polera-algodon', '2', 6000, 'POLERA-ALG-02'),
    ('polera-algodon', '4', 6000, 'POLERA-ALG-04'),
    ('polera-algodon', '6', 6000, 'POLERA-ALG-06'),
    ('polera-algodon', '8', 6000, 'POLERA-ALG-08'),
    ('polera-algodon', '10', 7000, 'POLERA-ALG-10'),
    ('polera-algodon', '12', 7000, 'POLERA-ALG-12'),
    ('polera-algodon', '14', 8000, 'POLERA-ALG-14'),
    ('polera-algodon', '16', 8000, 'POLERA-ALG-16'),
    ('polera-algodon', 'S', 10000, 'POLERA-ALG-S'),
    ('polera-algodon', 'M', 10000, 'POLERA-ALG-M'),
    ('polera-algodon', 'L', 10000, 'POLERA-ALG-L'),
    ('polera-algodon', 'XL', 10000, 'POLERA-ALG-XL'),
    ('polera-algodon', '2XL', 12000, 'POLERA-ALG-2XL'),
    ('polera-algodon', '3XL', 12000, 'POLERA-ALG-3XL'),
    ('polera-algodon', '4XL', 13000, 'POLERA-ALG-4XL'),
    ('polera-algodon', '5XL', 13000, 'POLERA-ALG-5XL')
), inserted_variants as (
  insert into public.product_variants (product_id, sku, size, price_clp)
  select p.id, v.sku, v.size, v.price_clp
  from variant_data v join public.products p on p.slug = v.product_slug
  on conflict (sku) do update set
    product_id = excluded.product_id,
    size = excluded.size,
    price_clp = excluded.price_clp
  returning id
)
insert into public.inventory (variant_id, on_hand)
select id, 0 from inserted_variants
on conflict (variant_id) do nothing;

insert into public.product_images (product_id, path, alt, sort_order)
select p.id, '/images/placeholder-image.png', 'Imagen referencial no disponible', 0
from public.products p
where p.slug in ('poleron-algodon', 'polera-algodon')
  and not exists (
    select 1 from public.product_images i
    where i.product_id = p.id and i.path = '/images/placeholder-image.png'
  );