-- 0025_ingest_review.sql
-- Aprovação da ingestão no /admin (item 16 of docs/MVP-PLANO.md). Until now a tier 2/3 record (a public event page,
-- the crawler) waited until someone added its `source:sourceId` to ingest/data/approved.json by hand.
--
--  * ingest_candidates: the records waiting for a decision. The daily ingest run (service_role, ingest/src/remote.ts)
--    upserts what it found pending and reads back the decisions; it never changes a decision. No client grant.
--  * Staff decide in /admin: admin_ingest_queue / admin_review_ingest (logged in admin_actions). An approved record
--    is published on the next ingest run (which also writes it to approved.json, so the repo keeps the record). A
--    rejected one stops showing up as pending.
--  * admin_overview gains ingest_pending (return type changes, so it is dropped and recreated).

create table public.ingest_candidates (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique check (char_length(key) between 3 and 300 and key like '%:%'),
  tier           smallint not null check (tier between 1 and 3),
  title          text not null check (char_length(title) between 1 and 200),
  starts_at      timestamptz not null,
  venue_name     text not null check (char_length(venue_name) between 1 and 200),
  venue_matched  boolean not null default false,
  source_url     text check (source_url is null or source_url ~* '^https://[^@/\s]+(/\S*)?$'),
  flags          text[] not null default '{}',
  -- Display only (price label, artists, genres, address); the ingest feed stays the source of truth.
  details        jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note    text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at    timestamptz,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);
create index ingest_candidates_pending_idx on public.ingest_candidates (starts_at) where status = 'pending';

alter table public.ingest_candidates enable row level security;
revoke all on public.ingest_candidates from anon, authenticated;
grant all on public.ingest_candidates to service_role;

-- The run may refresh what it saw (title, time, last_seen_at), never the decision.
create function public.ingest_candidates_keep_decision() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('qab.ingest_review', true) is distinct from 'on' then
    new.status := old.status;
    new.review_note := old.review_note;
    new.reviewed_at := old.reviewed_at;
  end if;
  new.first_seen_at := old.first_seen_at;
  return new;
end $$;
create trigger ingest_candidates_keep_decision before update on public.ingest_candidates
  for each row execute function public.ingest_candidates_keep_decision();

-- Audit log: one more target type.
alter table public.admin_actions drop constraint admin_actions_target_type_check;
alter table public.admin_actions add constraint admin_actions_target_type_check
  check (target_type in ('event', 'venue_account', 'venue', 'thread', 'comment', 'ticket', 'ingest_candidate'));

-- Queue: pending records whose night has not passed yet, soonest first.
create function public.admin_ingest_queue()
returns table (
  id             uuid,
  key            text,
  tier           smallint,
  title          text,
  starts_at      timestamptz,
  venue_name     text,
  venue_matched  boolean,
  source_url     text,
  flags          text[],
  details        jsonb,
  first_seen_at  timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
    select c.id, c.key, c.tier, c.title, c.starts_at, c.venue_name, c.venue_matched, c.source_url, c.flags, c.details,
           c.first_seen_at
    from public.ingest_candidates c
    where c.status = 'pending' and c.starts_at > now() - interval '12 hours'
    order by c.starts_at, c.first_seen_at;
end $$;

-- Refusing needs a reason (it stays in the log for the next curator).
create function public.admin_review_ingest(p_id uuid, p_approve boolean, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_status text;
  v_key text;
begin
  perform public.require_staff();
  if p_approve is null then perform public.venue_error('invalid_payload', 'approve'); end if;
  if not p_approve and char_length(coalesce(v_note, '')) < 3 then perform public.venue_error('note_required'); end if;
  select c.status, c.key into v_status, v_key from public.ingest_candidates c where c.id = p_id for update;
  if v_status is null then perform public.venue_error('candidate_not_found'); end if;
  if v_status <> 'pending' then perform public.venue_error('not_pending'); end if;
  perform set_config('qab.ingest_review', 'on', true);
  update public.ingest_candidates
     set status = case when p_approve then 'approved' else 'rejected' end,
         review_note = left(v_note, 500), reviewed_at = now()
   where id = p_id;
  perform set_config('qab.ingest_review', 'off', true);
  perform public.admin_log(case when p_approve then 'ingest_approve' else 'ingest_reject' end, 'ingest_candidate', p_id,
                           v_note, jsonb_build_object('key', v_key));
  return case when p_approve then 'approved' else 'rejected' end;
end $$;

-- Overview: + ingest_pending ----------------------------------------------------------------------------------------
drop function public.admin_overview();
create function public.admin_overview()
returns table (
  pending_events          int,
  pending_accounts        int,
  safety_seals            int,
  hidden_posts            int,
  open_safety_reports     int,
  oldest_safety_report_at timestamptz,
  ingest_pending          int
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query select
    (select count(*)::int from public.events e where e.status = 'pending_review'),
    (select count(*)::int from public.venue_accounts a where a.status = 'pending'),
    (select count(*)::int from public.venues v
       left join public.venue_safety_declarations d on d.venue_id = v.id
      where v.safety_protocol = 'contested'
         or (v.safety_protocol = 'declared' and d.reviewed_at is null)),
    ((select count(*)::int from public.threads t where t.status = 'hidden' and t.moderated_at is null)
     + (select count(*)::int from public.comments c where c.status = 'hidden' and c.moderated_at is null)),
    (select count(*)::int from public.safety_reports r join public.support_tickets k on k.id = r.ticket_id
      where k.status = 'open'),
    (select min(r.created_at) from public.safety_reports r join public.support_tickets k on k.id = r.ticket_id
      where k.status = 'open'),
    (select count(*)::int from public.ingest_candidates c
      where c.status = 'pending' and c.starts_at > now() - interval '12 hours');
end $$;

revoke execute on function public.admin_overview(), public.admin_ingest_queue(), public.admin_review_ingest(uuid, boolean, text)
  from public, anon;
revoke execute on function public.ingest_candidates_keep_decision() from public, anon, authenticated;
grant execute on function public.admin_overview(), public.admin_ingest_queue(), public.admin_review_ingest(uuid, boolean, text)
  to authenticated;

comment on table public.ingest_candidates is
  'Ingest records waiting for a curator (tier 2/3). Written by the ingest run (service_role), decided in /admin (0025).';
