-- Datos de ejemplo SOLO para desarrollo. El catálogo se carga en las migraciones.
insert into public.categories (slug, name, sort_order) values
  ('poleras','Poleras',1), ('polerones','Polerones',2), ('tazas','Tazas',3), ('bordados','Bordados',4)
on conflict do nothing;

insert into public.site_settings (key, value) values
  ('contact', '{"whatsapp":"+56950782244","email":"confeccionesalgase@gmail.com","instagram":"","facebook":""}'),
  ('shipping_flat_clp', '3990')
on conflict do nothing;
