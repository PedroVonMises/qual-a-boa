-- 0019_safety_protocol.sql
-- Selo "Protocolo Não é Não" (item S1 of docs/MVP-PLANO.md; Lei 14.786/2023).
--
--  * A casa (any member of a verified venue account with a venue, any plan) declares that it follows the protocol and
--    names who answers for it, optionally with a photo of the poster (same private bucket as festa posters, in the
--    account's folder). The venue shows "declarado" at once.
--  * Staff (service_role for now; the /admin back-office later) verifies it, rejects it, or marks it "contestado" when
--    reports contradict it (S3 will feed this). Only staff moves it to verified or contested, and only staff clears a
--    contest: a re-declaration never upgrades or hides the public state.
--  * The public state lives on venues (readable by everyone, writable by no client). The declaration itself (who
--    answers for it, the evidence) is private to the casa and staff.
--  * The seal is never sold: nothing here looks at the subscription.

alter table public.venues
  add column safety_protocol text
    constraint venues_safety_protocol_known check (safety_protocol in ('declared', 'verified', 'contested')),
  add column safety_protocol_at timestamptz;

create table public.venue_safety_declarations (
  venue_id          uuid primary key references public.venues (id) on delete cascade,
  venue_account_id  uuid not null references public.venue_accounts (id) on delete cascade,
  responsible_name  text not null check (char_length(btrim(responsible_name)) between 2 and 120),
  evidence_path     text check (evidence_path is null or evidence_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  declared_by       uuid references auth.users (id) on delete set null,
  declared_at       timestamptz not null default now(),
  reviewed_at       timestamptz,
  review_note       text check (review_note is null or char_length(review_note) <= 300)
);

-- RLS on, no policy and no client grant: read and written only through the functions below.
alter table public.venue_safety_declarations enable row level security;
revoke all on public.venue_safety_declarations from anon, authenticated;
grant all on public.venue_safety_declarations to service_role;

-- The casa's view of its declaration (members only). status is the public state; null = not declared or rejected
-- (review_note then says why).
create function public.my_safety_protocol(p_account uuid)
returns table (
  status            text,
  status_at         timestamptz,
  responsible_name  text,
  evidence_path     text,
  declared_at       timestamptz,
  reviewed_at       timestamptz,
  review_note       text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_venue uuid;
begin
  if auth.uid() is null then perform public.venue_error('not_authenticated'); end if;
  if not public.is_venue_member(p_account) then perform public.venue_error('not_member'); end if;
  select a.venue_id into v_venue from public.venue_accounts a where a.id = p_account;
  if v_venue is null then return; end if;
  return query
    select v.safety_protocol, v.safety_protocol_at, d.responsible_name, d.evidence_path,
           d.declared_at, d.reviewed_at, d.review_note
    from public.venues v
    left join public.venue_safety_declarations d on d.venue_id = v.id
    where v.id = v_venue;
end $$;

create function public.declare_safety_protocol(
  p_account           uuid,
  p_responsible_name  text,
  p_evidence_path     text default null
) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_responsible_name, ''));
  v_path text := nullif(btrim(coalesce(p_evidence_path, '')), '');
  v_status text;
  v_venue uuid;
  v_state text;
begin
  if v_uid is null then perform public.venue_error('not_authenticated'); end if;
  if not public.is_venue_member(p_account) then perform public.venue_error('not_member'); end if;
  select a.status, a.venue_id into v_status, v_venue from public.venue_accounts a where a.id = p_account;
  if v_status <> 'verified' then perform public.venue_error('account_not_verified'); end if;
  if v_venue is null then perform public.venue_error('venue_missing'); end if;
  if char_length(v_name) not between 2 and 120 then perform public.venue_error('invalid_responsible'); end if;
  if v_path is not null and (
       v_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
       or split_part(v_path, '/', 1) <> p_account::text) then
    perform public.venue_error('invalid_evidence');
  end if;

  insert into public.venue_safety_declarations as d
    (venue_id, venue_account_id, responsible_name, evidence_path, declared_by, declared_at)
  values (v_venue, p_account, v_name, v_path, v_uid, now())
  on conflict (venue_id) do update
    set venue_account_id = excluded.venue_account_id,
        responsible_name = excluded.responsible_name,
        -- Keeping the old photo when none is sent, so editing the name does not drop the evidence.
        evidence_path    = coalesce(excluded.evidence_path, d.evidence_path),
        declared_by      = excluded.declared_by,
        declared_at      = excluded.declared_at,
        reviewed_at      = null,
        review_note      = null;

  -- Only a venue without the seal becomes "declared"; verified and contested stay as staff left them.
  update public.venues
     set safety_protocol = 'declared', safety_protocol_at = now()
   where id = v_venue and safety_protocol is null;
  select v.safety_protocol into v_state from public.venues v where v.id = v_venue;
  return v_state;
end $$;

-- Staff decision. p_decision: verify | reject | contest. Returns the new public state (null after reject).
create function public.review_safety_protocol(p_venue_id uuid, p_decision text, p_note text default null)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_state text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_decision not in ('verify', 'reject', 'contest') then perform public.venue_error('invalid_payload', 'decision'); end if;
  if p_decision <> 'contest'
     and not exists (select 1 from public.venue_safety_declarations d where d.venue_id = p_venue_id) then
    perform public.venue_error('protocol_not_declared');
  end if;
  if not exists (select 1 from public.venues v where v.id = p_venue_id) then perform public.venue_error('venue_not_found'); end if;
  v_state := case p_decision when 'verify' then 'verified' when 'contest' then 'contested' else null end;
  update public.venues set safety_protocol = v_state, safety_protocol_at = now() where id = p_venue_id;
  update public.venue_safety_declarations
     set reviewed_at = now(), review_note = left(v_note, 300)
   where venue_id = p_venue_id;
  return v_state;
end $$;

revoke execute on function public.my_safety_protocol(uuid) from public, anon;
revoke execute on function public.declare_safety_protocol(uuid, text, text) from public, anon;
revoke execute on function public.review_safety_protocol(uuid, text, text) from public, anon, authenticated;
grant execute on function public.my_safety_protocol(uuid) to authenticated;
grant execute on function public.declare_safety_protocol(uuid, text, text) to authenticated;
grant execute on function public.review_safety_protocol(uuid, text, text) to service_role;

comment on column public.venues.safety_protocol is
  'Selo Protocolo Não é Não: declared (by the casa), verified or contested (by staff). Never sold. See 0019.';
