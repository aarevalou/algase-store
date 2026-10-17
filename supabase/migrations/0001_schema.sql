-- Algase · Esquema inicial. Fechas en timestamptz (UTC); la app las muestra en America/Santiago.
-- Montos en CLP: numeric(12,0) con columna currency explícita.

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type public.user_role          as enum ('customer', 'admin');
create type public.order_status       as enum ('pending_payment','confirmed','in_production','ready','shipped','delivered','cancelled');
create type public.payment_status     as enum ('pending','paid','failed','cancelled','refunded','partially_refunded');
create type public.payment_provider   as enum ('webpay','mercadopago');
create type public.fulfillment_method as enum ('shipping','pickup');
create type public.shipment_status    as enum ('preparing','shipped','delivered','returned');

-- ---------- Utilidades ----------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- Perfiles ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  role       public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  label       text,
  recipient   text not null,
  phone       text not null,
  street      text not null,
  number      text,
  apartment   text,
  commune     text not null,
  region      text not null,
  notes       text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.addresses (user_id);
create trigger trg_addresses_updated before update on public.addresses
  for each row execute function public.set_updated_at();

-- ---------- Catálogo ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name       text not null,
  description text,
  image_path text,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_categories_updated before update on public.categories
  for each row execute function public.set_updated_at();

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  description text,
  base_price_clp numeric(12,0) not null check (base_price_clp >= 0),
  currency    char(3) not null default 'CLP' check (currency = 'CLP'),
  customizable boolean not null default false,
  customization_fee_clp numeric(12,0) not null default 0 check (customization_fee_clp >= 0),
  is_featured boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.products (category_id);
create index on public.products (is_active, is_featured);
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path       text not null,           -- ruta en Supabase Storage (bucket product-images)
  alt        text,
  sort_order int not null default 0
);
create index on public.product_images (product_id, sort_order);

create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku        text not null unique,
  size       text,
  color      text,
  price_clp  numeric(12,0) check (price_clp >= 0),   -- null = usa base_price_clp del producto
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size, color)
);
create index on public.product_variants (product_id);
create trigger trg_variants_updated before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  on_hand    int not null default 0 check (on_hand >= 0),
  reserved   int not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  check (reserved <= on_hand)
);
create trigger trg_inventory_updated before update on public.inventory
  for each row execute function public.set_updated_at();

create table public.inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id),
  delta      int not null,
  reason     text not null,           -- 'sale','manual_adjustment','restock','release'
  order_id   uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.inventory_movements (variant_id, created_at desc);

-- ---------- Carritos persistentes (usuarios con sesión; invitados usan localStorage) ----------
create table public.carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity   int not null check (quantity between 1 and 50),
  customization jsonb,
  unique (cart_id, variant_id)
);

-- ---------- Promociones ----------
create table public.promotions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  description text,
  percent_off int check (percent_off between 1 and 100),
  amount_off_clp numeric(12,0) check (amount_off_clp > 0),
  min_subtotal_clp numeric(12,0) not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  max_uses   int,
  used_count int not null default 0,
  is_active  boolean not null default true,
  check ((percent_off is not null) <> (amount_off_clp is not null))
);

-- ---------- Pedidos ----------
create sequence public.order_number_seq start 1000;

create table public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_number  bigint not null unique default nextval('public.order_number_seq'),
  user_id       uuid not null references public.profiles(id),
  status        public.order_status not null default 'pending_payment',
  fulfillment   public.fulfillment_method not null,
  contact_name  text not null,
  contact_email text not null,
  contact_phone text not null,
  shipping_address jsonb,             -- copia histórica de la dirección
  subtotal_clp  numeric(12,0) not null check (subtotal_clp >= 0),
  shipping_clp  numeric(12,0) not null default 0 check (shipping_clp >= 0),
  discount_clp  numeric(12,0) not null default 0 check (discount_clp >= 0),
  total_clp     numeric(12,0) not null check (total_clp >= 0),
  currency      char(3) not null default 'CLP' check (currency = 'CLP'),
  promotion_id  uuid references public.promotions(id),
  idempotency_key uuid not null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (total_clp = subtotal_clp + shipping_clp - discount_clp),
  check (fulfillment = 'pickup' or shipping_address is not null)
);
create index on public.orders (user_id, created_at desc);
create index on public.orders (status);
create trigger trg_orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  variant_id    uuid references public.product_variants(id) on delete set null,
  -- Snapshot histórico: no cambia aunque el producto se edite o elimine
  product_name  text not null,
  variant_label text,
  sku           text not null,
  unit_price_clp numeric(12,0) not null check (unit_price_clp >= 0),
  customization_fee_clp numeric(12,0) not null default 0,
  quantity      int not null check (quantity > 0),
  line_total_clp numeric(12,0) not null check (line_total_clp >= 0)
);
create index on public.order_items (order_id);

create table public.order_item_customizations (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  placement     text,                 -- 'front','back','sleeve', etc.
  text_content  text,
  file_path     text,                 -- bucket privado customer-designs
  notes         text
);
create index on public.order_item_customizations (order_item_id);

-- ---------- Pagos ----------
create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id),
  provider     public.payment_provider not null,
  status       public.payment_status not null default 'pending',
  amount_clp   numeric(12,0) not null check (amount_clp > 0),
  currency     char(3) not null default 'CLP' check (currency = 'CLP'),
  external_id  text,                  -- token Webpay / id de preferencia o pago MP
  buy_order    text,
  raw_response jsonb,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index payments_provider_external_uq on public.payments (provider, external_id) where external_id is not null;
create unique index payments_one_paid_per_order on public.payments (order_id) where status = 'paid';
create index on public.payments (order_id);
create trigger trg_payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

create table public.payment_events (          -- idempotencia de webhooks
  id          uuid primary key default gen_random_uuid(),
  provider    public.payment_provider not null,
  event_id    text not null,
  payload     jsonb,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table public.refunds (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references public.payments(id),
  amount_clp  numeric(12,0) not null check (amount_clp > 0),
  reason      text,
  external_id text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- ---------- Despachos ----------
create table public.shipments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id),
  carrier     text,
  tracking_code text,
  status      public.shipment_status not null default 'preparing',
  shipped_at  timestamptz,
  delivered_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.shipments (order_id);
create trigger trg_shipments_updated before update on public.shipments
  for each row execute function public.set_updated_at();

-- ---------- Configuración del sitio (contacto, redes, costos de envío) ----------
create table public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- Auditoría ----------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (entity, entity_id);
