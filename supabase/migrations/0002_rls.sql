-- Algase · Row Level Security. Principio: denegar por defecto y abrir lo mínimo.

alter table public.profiles                  enable row level security;
alter table public.addresses                 enable row level security;
alter table public.categories                enable row level security;
alter table public.products                  enable row level security;
alter table public.product_images            enable row level security;
alter table public.product_variants          enable row level security;
alter table public.inventory                 enable row level security;
alter table public.inventory_movements       enable row level security;
alter table public.carts                     enable row level security;
alter table public.cart_items                enable row level security;
alter table public.promotions                enable row level security;
alter table public.orders                    enable row level security;
alter table public.order_items               enable row level security;
alter table public.order_item_customizations enable row level security;
alter table public.payments                  enable row level security;
alter table public.payment_events            enable row level security;
alter table public.refunds                   enable row level security;
alter table public.shipments                 enable row level security;
alter table public.site_settings             enable row level security;
alter table public.audit_log                 enable row level security;

-- Perfiles: cada usuario ve y edita el suyo; el rol NO es editable por el cliente.
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin());
revoke update on public.profiles from authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;
-- (el cambio de rol lo hace un admin vía SQL o función de servidor, nunca desde el cliente)

-- Direcciones
create policy addresses_own on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_admin_read on public.addresses for select using (public.is_admin());

-- Catálogo: lectura pública solo de lo activo; escritura solo admin.
create policy categories_read  on public.categories for select using (is_active or public.is_admin());
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy products_read    on public.products for select using (is_active or public.is_admin());
create policy products_admin   on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy images_read      on public.product_images for select using (true);
create policy images_admin     on public.product_images for all using (public.is_admin()) with check (public.is_admin());
create policy variants_read    on public.product_variants for select using (is_active or public.is_admin());
create policy variants_admin   on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

-- Inventario: el público ve existencias (para mostrar disponibilidad); solo admin escribe.
create policy inventory_read   on public.inventory for select using (true);
create policy inventory_admin  on public.inventory for all using (public.is_admin()) with check (public.is_admin());
create policy movements_admin  on public.inventory_movements for select using (public.is_admin());

-- Carritos
create policy carts_own on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

-- Promociones: solo admin (la validación de códigos ocurre en el servidor).
create policy promotions_admin on public.promotions for all using (public.is_admin()) with check (public.is_admin());

-- Pedidos: el cliente SOLO lee los suyos. Crear/modificar pedidos pasa por funciones del servidor.
create policy orders_select on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy order_items_select on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy order_customizations_select on public.order_item_customizations for select
  using (exists (select 1 from public.order_items i join public.orders o on o.id = i.order_id
                 where i.id = order_item_id and (o.user_id = auth.uid() or public.is_admin())));

-- Pagos y reembolsos: lectura propia/admin; escritura solo service_role (sin política = denegado).
create policy payments_select on public.payments for select
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy refunds_admin on public.refunds for select using (public.is_admin());
create policy shipments_select on public.shipments for select
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy shipments_admin on public.shipments for all using (public.is_admin()) with check (public.is_admin());

-- payment_events: sin políticas → solo service_role.
-- Ajustes del sitio: lectura pública (contacto, redes); escritura admin.
create policy settings_read  on public.site_settings for select using (true);
create policy settings_admin on public.site_settings for all using (public.is_admin()) with check (public.is_admin());
create policy audit_admin    on public.audit_log for select using (public.is_admin());

-- ---------- Storage (buckets) ----------
insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('customer-designs','customer-designs', false, 10485760,
          array['image/png','image/jpeg','image/webp','application/pdf'])
  on conflict (id) do nothing;

create policy product_images_admin_write on storage.objects for all
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
-- Diseños de clientes: cada usuario sube/lee solo dentro de su carpeta <user_id>/...
create policy designs_own on storage.objects for all
  using (bucket_id = 'customer-designs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  with check (bucket_id = 'customer-designs' and (storage.foldername(name))[1] = auth.uid()::text);
