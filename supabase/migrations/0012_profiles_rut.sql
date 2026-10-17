begin;

alter table public.profiles
  add column if not exists rut text;

grant select on public.profiles, public.addresses to authenticated;

notify pgrst, 'reload schema';

commit;