-- 0022_venue_return_info.sql
-- Informações de volta da casa (item S8 of docs/MVP-PLANO.md): where to wait for a ride-hailing car, whether the street
-- is well lit, the nearest bus stop and parking. Filled by the casa (any member of a verified account, any plan, like
-- the S1 seal: safety information is never sold) and shown on the venue page. Community validation comes later.
--
--  * venues.return_info: jsonb with known keys only (valid_return_info), readable by everyone (venues are public),
--    written by no client except through set_return_info. return_info_at: when the casa last changed it.
--  * Keys: rideshare_point (text), bus_stop (text), lit_street ('sim' | 'em_parte' | 'nao'),
--    parking ('proprio' | 'conveniado' | 'rua' | 'nao'). Texts 2..140 characters.

create function public.valid_return_info(s jsonb) returns boolean
language sql immutable parallel safe as $$
  select jsonb_typeof(s) = 'object'
     and not exists (
       select 1 from jsonb_each(s) kv
       where jsonb_typeof(kv.value) <> 'string'
          or not case kv.key
                   when 'rideshare_point' then char_length(kv.value #>> '{}') between 2 and 140
                   when 'bus_stop'        then char_length(kv.value #>> '{}') between 2 and 140
                   when 'lit_street'      then kv.value #>> '{}' in ('sim', 'em_parte', 'nao')
                   when 'parking'         then kv.value #>> '{}' in ('proprio', 'conveniado', 'rua', 'nao')
                   else false
                 end)
$$;

alter table public.venues
  add column return_info jsonb not null default '{}'
    constraint venues_return_info_valid check (public.valid_return_info(return_info)),
  add column return_info_at timestamptz;

-- The casa saves the whole block: empty or missing keys are removed. Returns what was stored.
create function public.set_return_info(p_account uuid, p_info jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_status text;
  v_venue uuid;
  v_clean jsonb := '{}'::jsonb;
  k text;
  v text;
begin
  if auth.uid() is null then perform public.venue_error('not_authenticated'); end if;
  if not public.is_venue_member(p_account) then perform public.venue_error('not_member'); end if;
  select a.status, a.venue_id into v_status, v_venue from public.venue_accounts a where a.id = p_account;
  if v_status <> 'verified' then perform public.venue_error('account_not_verified'); end if;
  if v_venue is null then perform public.venue_error('venue_missing'); end if;
  if p_info is null or jsonb_typeof(p_info) <> 'object' then perform public.venue_error('invalid_payload', 'return_info'); end if;

  for k, v in select key, btrim(regexp_replace(value #>> '{}', '\s+', ' ', 'g')) from jsonb_each(p_info)
               where jsonb_typeof(value) = 'string' loop
    if v <> '' then v_clean := v_clean || jsonb_build_object(k, v); end if;
  end loop;
  if exists (select 1 from jsonb_each(p_info) where jsonb_typeof(value) not in ('string', 'null'))
     or not public.valid_return_info(v_clean) then
    perform public.venue_error('invalid_payload', 'return_info');
  end if;

  update public.venues set return_info = v_clean, return_info_at = now() where id = v_venue;
  return v_clean;
end $$;

revoke execute on function public.set_return_info(uuid, jsonb) from public, anon;
grant execute on function public.set_return_info(uuid, jsonb) to authenticated;

comment on column public.venues.return_info is
  'Informações de volta (S8): rideshare_point, bus_stop, lit_street, parking. Set by the casa via set_return_info (0022).';
