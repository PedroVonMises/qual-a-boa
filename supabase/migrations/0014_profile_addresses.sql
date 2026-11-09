-- 0014_profile_addresses.sql
-- Registered address ("Dados cadastrais"): one row per user, owner-only.
-- Coordinates come from on-device geocoding; the app also keeps the address locally (local-first).

create table public.profile_addresses (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cep         text not null check (cep ~ '^[0-9]{8}$'),
  street      text not null check (char_length(street) between 1 and 200),
  number      text not null check (char_length(number) between 1 and 20),
  complement  text check (complement is null or char_length(complement) <= 100),
  district    text not null check (char_length(district) between 1 and 120),
  city        text not null check (char_length(city) between 1 and 120),
  uf          char(2) not null check (uf ~ '^[A-Z]{2}$'),
  lat         double precision check (lat is null or lat between -90 and 90),
  lng         double precision check (lng is null or lng between -180 and 180),
  updated_at  timestamptz not null default now()
);

alter table public.profile_addresses enable row level security;

revoke all on public.profile_addresses from anon, authenticated;
grant select, insert, update, delete on public.profile_addresses to authenticated;
grant all on public.profile_addresses to service_role;

create policy profile_addresses_owner_select on public.profile_addresses
  for select to authenticated using (user_id = (select auth.uid()));
create policy profile_addresses_owner_insert on public.profile_addresses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy profile_addresses_owner_update on public.profile_addresses
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profile_addresses_owner_delete on public.profile_addresses
  for delete to authenticated using (user_id = (select auth.uid()));
