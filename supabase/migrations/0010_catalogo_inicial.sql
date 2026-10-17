insert into public.categories (slug, name, sort_order)
values
  ('poleras', 'Poleras', 1),
  ('polerones', 'Polerones', 2),
  ('tazas', 'Tazas', 3)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

with product_data (
  category_slug, slug, name, description, base_price_clp, colors, image_path, image_alt
) as (
  values
    (
      'polerones', 'poleron-algodon', 'Polerón de algodón',
      'Polerón de algodón de fabricación propia, listo para personalizar con estampados, frases o diseños. Consulta por colores disponibles y envíanos tu idea.',
      10000,
      '[{"name":"Negro","hex":"#171717"},{"name":"Gris","hex":"#7b7b7b"},{"name":"Gris grafito","hex":"#414141"},{"name":"Blanco","hex":"#f5f5f5"}]'::jsonb,
      '/images/placeholder-image.png', 'Imagen referencial no disponible'
    ),
    (
      'poleras', 'polera-algodon', 'Polera de algodón',
      'Polera de algodón de fabricación propia, ideal para estampados personalizados, frases, ilustraciones o identidad de marca. Consulta por colores disponibles y envíanos tu idea.',
      6000,
      '[{"name":"Blanco","hex":"#f5f5f5"},{"name":"Negro","hex":"#171717"},{"name":"Rosado","hex":"#e6007e"},{"name":"Gris grafito","hex":"#414141"}]'::jsonb,
      '/images/background-polera-2.png', 'Polera de algodón con marca Algase personalizada'
    ),
    (
      'poleras', 'polera-manga-corta', 'Polera manga corta',
      'Polera unisex de algodón, cómoda para uso diario y personalización con estampado frontal, espalda o mangas.',
      5990,
      '[{"name":"Negro","hex":"#171717"},{"name":"Blanco","hex":"#f5f5f5"},{"name":"Rosado","hex":"#e6007e"},{"name":"Gris grafito","hex":"#414141"}]'::jsonb,
      '/images/background-polera.png', 'Polera manga corta con estampado Algase'
    ),
    (
      'poleras', 'polera-manga-larga', 'Polera manga larga',
      'Polera de algodón de manga larga, ideal para estampar diseños personalizados y vestir durante todo el año.',
      7990,
      '[{"name":"Negro","hex":"#171717"},{"name":"Blanco","hex":"#f5f5f5"},{"name":"Gris grafito","hex":"#414141"},{"name":"Rosado","hex":"#e6007e"}]'::jsonb,
      '/images/background-polera-2.png', 'Prenda Algase con estampado personalizado'
    ),
    (
      'poleras', 'polera-oversize', 'Polera oversize',
      'Polera oversize de algodón con calce amplio, preparada para personalización mediante estampado.',
      11990,
      '[{"name":"Gris grafito","hex":"#414141"},{"name":"Negro","hex":"#171717"},{"name":"Blanco","hex":"#f5f5f5"}]'::jsonb,
      '/images/placeholder-image.png', 'Polera oversize referencial'
    ),
    (
      'polerones', 'poleron-canguro', 'Polerón canguro',
      'Polerón con capucha y bolsillo canguro, ideal para personalizar con un estampado propio.',
      12990,
      '[{"name":"Negro","hex":"#171717"},{"name":"Gris","hex":"#7b7b7b"},{"name":"Gris grafito","hex":"#414141"}]'::jsonb,
      '/images/placeholder-image.png', 'Polerón canguro referencial'
    ),
    (
      'tazas', 'taza-ceramica-personalizada', 'Taza de cerámica personalizada',
      'Taza de cerámica para personalizar con fotografías, ilustraciones, frases o diseños propios.',
      6990,
      '[{"name":"Blanco","hex":"#f5f5f5"},{"name":"Interior negro","hex":"#242424"},{"name":"Interior rosado","hex":"#e6007e"},{"name":"Interior grafito","hex":"#414141"}]'::jsonb,
      '/images/background-taza.png', 'Taza personalizada Algase'
    ),
    (
      'tazas', 'taza-magica', 'Taza mágica',
      'Taza de acabado térmico para revelar tu diseño con el calor. Personalizable con imagen o frase.',
      9990,
      '[{"name":"Negro","hex":"#242424"}]'::jsonb,
      '/images/placeholder-image.png', 'Taza mágica referencial'
    )
)
insert into public.products (
  category_id, slug, name, description, base_price_clp,
  customizable, customization_fee_clp, is_featured, colors, is_active
)
select
  c.id, d.slug, d.name, d.description, d.base_price_clp,
  true, 0, true, d.colors, true
from product_data d
join public.categories c on c.slug = d.category_slug
on conflict (slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  base_price_clp = excluded.base_price_clp,
  customizable = excluded.customizable,
  customization_fee_clp = excluded.customization_fee_clp,
  is_featured = excluded.is_featured,
  colors = excluded.colors,
  is_active = true;

update public.products
set is_active = false
where slug = 'polera-oversize-negra';

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
    ('polera-algodon', '5XL', 13000, 'POLERA-ALG-5XL'),
    ('polera-manga-corta', 'S', 5990, 'POLERA-MC-S'),
    ('polera-manga-corta', 'M', 5990, 'POLERA-MC-M'),
    ('polera-manga-corta', 'L', 5990, 'POLERA-MC-L'),
    ('polera-manga-corta', 'XL', 6990, 'POLERA-MC-XL'),
    ('polera-manga-larga', 'S', 7990, 'POLERA-ML-S'),
    ('polera-manga-larga', 'M', 7990, 'POLERA-ML-M'),
    ('polera-manga-larga', 'L', 7990, 'POLERA-ML-L'),
    ('polera-manga-larga', 'XL', 8990, 'POLERA-ML-XL'),
    ('polera-oversize', 'S', 11990, 'POLERA-OVS-S'),
    ('polera-oversize', 'M', 11990, 'POLERA-OVS-M'),
    ('polera-oversize', 'L', 11990, 'POLERA-OVS-L'),
    ('polera-oversize', 'XL', 12990, 'POLERA-OVS-XL'),
    ('poleron-canguro', 'S', 12990, 'POLERON-CANG-S'),
    ('poleron-canguro', 'M', 12990, 'POLERON-CANG-M'),
    ('poleron-canguro', 'L', 12990, 'POLERON-CANG-L'),
    ('poleron-canguro', 'XL', 13990, 'POLERON-CANG-XL'),
    ('taza-ceramica-personalizada', '330 ml', 6990, 'TAZA-CER-330'),
    ('taza-magica', '330 ml', 9990, 'TAZA-MAG-330')
), saved_variants as (
  insert into public.product_variants (product_id, sku, size, price_clp, is_active)
  select p.id, v.sku, v.size, v.price_clp, true
  from variant_data v
  join public.products p on p.slug = v.product_slug
  on conflict (sku) do update set
    product_id = excluded.product_id,
    size = excluded.size,
    price_clp = excluded.price_clp,
    is_active = true
  returning id
)
insert into public.inventory (variant_id, on_hand)
select id, 0 from saved_variants
on conflict (variant_id) do nothing;

with image_data (slug, path, alt) as (
  values
    ('poleron-algodon', '/images/placeholder-image.png', 'Imagen referencial no disponible'),
    ('polera-algodon', '/images/background-polera-2.png', 'Polera de algodón con marca Algase personalizada'),
    ('polera-manga-corta', '/images/background-polera.png', 'Polera manga corta con estampado Algase'),
    ('polera-manga-larga', '/images/background-polera-2.png', 'Prenda Algase con estampado personalizado'),
    ('polera-oversize', '/images/placeholder-image.png', 'Polera oversize referencial'),
    ('poleron-canguro', '/images/placeholder-image.png', 'Polerón canguro referencial'),
    ('taza-ceramica-personalizada', '/images/background-taza.png', 'Taza personalizada Algase'),
    ('taza-magica', '/images/placeholder-image.png', 'Taza mágica referencial')
)
update public.product_images image
set path = data.path,
    alt = data.alt,
    sort_order = 0
from image_data data
join public.products product on product.slug = data.slug
where image.product_id = product.id
  and image.path = '/images/placeholder-image.png'
  and data.path <> '/images/placeholder-image.png';

with image_data (slug, path, alt) as (
  values
    ('poleron-algodon', '/images/placeholder-image.png', 'Imagen referencial no disponible'),
    ('polera-algodon', '/images/background-polera-2.png', 'Polera de algodón con marca Algase personalizada'),
    ('polera-manga-corta', '/images/background-polera.png', 'Polera manga corta con estampado Algase'),
    ('polera-manga-larga', '/images/background-polera-2.png', 'Prenda Algase con estampado personalizado'),
    ('polera-oversize', '/images/placeholder-image.png', 'Polera oversize referencial'),
    ('poleron-canguro', '/images/placeholder-image.png', 'Polerón canguro referencial'),
    ('taza-ceramica-personalizada', '/images/background-taza.png', 'Taza personalizada Algase'),
    ('taza-magica', '/images/placeholder-image.png', 'Taza mágica referencial')
)
insert into public.product_images (product_id, path, alt, sort_order)
select product.id, data.path, data.alt, 0
from image_data data
join public.products product on product.slug = data.slug
where not exists (
  select 1 from public.product_images image where image.product_id = product.id
);

notify pgrst, 'reload schema';