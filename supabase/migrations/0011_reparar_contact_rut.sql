alter table public.orders
  add column if not exists contact_rut text;

notify pgrst, 'reload schema';