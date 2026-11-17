-- 0021_safety_reports.sql
-- Denúncia de assédio, "Aconteceu algo comigo" (item S3 of docs/MVP-PLANO.md).
--
--  * A report is a support ticket (topic 'seguranca'), so the person talks to the team in Mensagens like any other
--    ticket, plus a private row in safety_reports with the venue and the kind of incident. Never published, never
--    visible to the casa (no client grant at all): the venue only ever sees the effect on its seal.
--  * Seal feedback: when SAFETY_CONTEST_REPORTERS distinct people who checked in at that venue (B5, proximity-checked)
--    report within SAFETY_CONTEST_DAYS, a declared or verified seal becomes "contested" until staff reviews it
--    (review_safety_protocol, 0019). Only reports since the seal last changed count, so a review starts over. Only accounts that are not anonymous and are at least 24 h old count, the same
--    anti-brigade rule as community reports (0017), so a group of fresh accounts cannot take a seal down.
--  * Throttle: 3 reports per person per 24 h.

create table public.safety_reports (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null unique references public.support_tickets (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  venue_id    uuid not null references public.venues (id) on delete cascade,
  event_id    uuid references public.events (id) on delete set null,
  kind        text not null check (kind in ('assedio', 'importunacao', 'violencia', 'discriminacao', 'outro')),
  -- Snapshot at report time: the reporter had a check-in at this venue's event (or any event there in the last 12 h).
  checked_in  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index safety_reports_venue_idx on public.safety_reports (venue_id, created_at desc);
create index safety_reports_user_idx on public.safety_reports (user_id, created_at desc);

alter table public.safety_reports enable row level security;
revoke all on public.safety_reports from anon, authenticated;
grant all on public.safety_reports to service_role;

create function public.report_safety_incident(
  p_venue_id     uuid,
  p_event_id     uuid,
  p_kind         text,
  p_description  text
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_desc text := btrim(coalesce(p_description, ''));
  v_ticket uuid;
  v_checked boolean;
  v_reporters int;
  contest_reporters constant int := 3;
  contest_days constant interval := interval '90 days';
begin
  if me is null then raise exception 'not_authenticated' using errcode = 'P0001', hint = 'not_authenticated'; end if;
  if p_kind is null or p_kind not in ('assedio', 'importunacao', 'violencia', 'discriminacao', 'outro') then
    raise exception 'invalid_kind' using errcode = 'P0001', hint = 'invalid_kind';
  end if;
  if char_length(v_desc) not between 1 and 4000 then
    raise exception 'invalid_description' using errcode = 'P0001', hint = 'invalid_description';
  end if;
  if not exists (select 1 from public.venues where id = p_venue_id) then
    raise exception 'venue_not_found' using errcode = 'P0001', hint = 'venue_not_found';
  end if;
  if p_event_id is not null and not exists (select 1 from public.events where id = p_event_id and venue_id = p_venue_id) then
    raise exception 'event_not_found' using errcode = 'P0001', hint = 'event_not_found';
  end if;
  if (select count(*) from public.safety_reports where user_id = me and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  select exists (
    select 1 from public.checkins c join public.events e on e.id = c.event_id
    where c.user_id = me and e.venue_id = p_venue_id
      and (c.event_id = p_event_id or c.at > now() - interval '12 hours')
  ) into v_checked;

  insert into public.support_tickets (user_id, topic, event_id, description)
  values (me, 'seguranca', p_event_id, v_desc)
  returning id into v_ticket;
  insert into public.safety_reports (ticket_id, user_id, venue_id, event_id, kind, checked_in)
  values (v_ticket, me, p_venue_id, p_event_id, p_kind, v_checked);

  select count(distinct r.user_id) into v_reporters
  from public.safety_reports r
  join auth.users u on u.id = r.user_id
  join public.venues v on v.id = r.venue_id
  where r.venue_id = p_venue_id and r.checked_in and r.created_at > now() - contest_days
    -- Only reports since the seal last changed: a staff review (or a new declaration) starts the count again.
    and r.created_at >= coalesce(v.safety_protocol_at, '-infinity'::timestamptz)
    and not u.is_anonymous and u.created_at <= now() - interval '24 hours';
  if v_reporters >= contest_reporters then
    update public.venues set safety_protocol = 'contested', safety_protocol_at = now()
     where id = p_venue_id and safety_protocol in ('declared', 'verified');
  end if;

  return v_ticket;
end $$;

revoke execute on function public.report_safety_incident(uuid, uuid, text, text) from public, anon;
grant execute on function public.report_safety_incident(uuid, uuid, text, text) to authenticated;
