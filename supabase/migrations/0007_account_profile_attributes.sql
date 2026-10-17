alter table public.profiles
  add column if not exists rut text;

insert into public.profiles (id, full_name)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
on conflict (id) do nothing;

with ranked_defaults as (
  select id,
         row_number() over (partition by user_id order by updated_at desc, created_at desc, id) as position
  from public.addresses
  where is_default
)
update public.addresses a
set is_default = false
from ranked_defaults r
where a.id = r.id and r.position > 1;

create unique index if not exists addresses_one_default_per_user_idx
  on public.addresses (user_id)
  where is_default;

grant select on public.profiles, public.addresses to authenticated;

create or replace function public.save_my_account_details(
  p_full_name text,
  p_phone text,
  p_rut text,
  p_address jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid;
begin
  if v_user_id is null then
    raise exception 'Inicia sesión para guardar tus datos';
  end if;
  if nullif(trim(p_full_name), '') is null then
    raise exception 'El nombre es obligatorio';
  end if;

  update public.profiles
     set full_name = trim(p_full_name),
         phone = nullif(trim(p_phone), ''),
         rut = nullif(trim(p_rut), '')
   where id = v_user_id;

  if not found then
    raise exception 'No se encontró el perfil de esta cuenta';
  end if;

  if p_address is null then
    delete from public.addresses
     where user_id = v_user_id and is_default;
    return;
  end if;

  if jsonb_typeof(p_address) is distinct from 'object'
     or nullif(trim(p_address->>'street'), '') is null
     or nullif(trim(p_address->>'commune'), '') is null
     or nullif(trim(p_address->>'region'), '') is null then
    raise exception 'Completa calle, comuna y región, o deja toda la dirección vacía';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select id into v_address_id
    from public.addresses
   where user_id = v_user_id and is_default
   limit 1
   for update;

  update public.addresses
     set is_default = false
   where user_id = v_user_id and is_default and id is distinct from v_address_id;

  if v_address_id is null then
    insert into public.addresses (
      user_id, label, recipient, phone, street, number, commune, region, is_default
    ) values (
      v_user_id,
      'Dirección predeterminada',
      trim(p_full_name),
      coalesce(nullif(trim(p_phone), ''), 'Sin teléfono'),
      trim(p_address->>'street'),
      nullif(trim(p_address->>'number'), ''),
      trim(p_address->>'commune'),
      trim(p_address->>'region'),
      true
    );
  else
    update public.addresses
       set label = 'Dirección predeterminada',
           recipient = trim(p_full_name),
           phone = coalesce(nullif(trim(p_phone), ''), 'Sin teléfono'),
           street = trim(p_address->>'street'),
           number = nullif(trim(p_address->>'number'), ''),
           commune = trim(p_address->>'commune'),
           region = trim(p_address->>'region'),
           is_default = true
     where id = v_address_id and user_id = v_user_id;
  end if;
end
$$;

revoke all on function public.save_my_account_details(text, text, text, jsonb) from public, anon;
grant execute on function public.save_my_account_details(text, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
