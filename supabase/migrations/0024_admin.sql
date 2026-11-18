-- 0024_admin.sql
-- Back-office mínimo, /admin (item 5.6 of docs/MVP-PLANO.md). Until now the team verified casas, approved festas,
-- reviewed seals and moderated with raw service_role updates. This gives the team a protected area with:
--
--  * staff_members: who is on the team. A separate table instead of a column on profiles, because clients may update
--    their own profiles row and must never be able to make themselves staff. No client grant at all: a person joins
--    the team with a service_role insert (SQL editor), and leaves with a delete.
--  * is_staff(): whether the signed-in user is on the team (the app uses it to show or hide /admin). Every admin_*
--    function below checks it server-side (require_staff), so the screen is only a convenience, never the guard.
--  * admin_actions: audit log, who did what, when, on which target, with the note. Written only by the admin_*
--    functions; staff read it, nobody edits or deletes it from a client.
--  * Queues + decisions, each logged:
--      festas pendentes      admin_pending_events / admin_review_event (wraps review_event) / admin_verify_event
--      casas a verificar     admin_pending_accounts / admin_review_account (links or creates the venue)
--      selo S1               admin_safety_queue / admin_review_safety (wraps review_safety_protocol)
--      posts ocultados       admin_hidden_posts / admin_moderate (restore or keep hidden)
--      relatos de segurança  admin_safety_reports / admin_reply_ticket (answers in Mensagens, can close)
--  * Staff can read festa posters and seal photos in the private event-posters bucket.
--
-- Ingest approval (item 16) stays in the ingest pipeline for now (data/approved.json in the repo).

-- Team -----------------------------------------------------------------------------------------------------------------
create table public.staff_members (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now(),
  note      text check (note is null or char_length(note) <= 200)
);
alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;
grant all on public.staff_members to service_role;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.staff_members s where s.user_id = auth.uid())
$$;

create function public.require_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then perform public.venue_error('not_authenticated'); end if;
  if not public.is_staff() then perform public.venue_error('not_staff'); end if;
end $$;

-- Audit log ------------------------------------------------------------------------------------------------------------
create table public.admin_actions (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users (id) on delete set null,
  action       text not null check (action ~ '^[a-z_]{3,40}$'),
  target_type  text not null check (target_type in ('event', 'venue_account', 'venue', 'thread', 'comment', 'ticket')),
  target_id    uuid not null,
  note         text check (note is null or char_length(note) <= 500),
  details      jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  created_at   timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions (created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_type, target_id, created_at desc);

alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;
grant all on public.admin_actions to service_role;

create function public.admin_log(p_action text, p_target_type text, p_target_id uuid, p_note text, p_details jsonb default '{}')
returns void
language sql volatile security definer set search_path = public as $$
  insert into public.admin_actions (actor_id, action, target_type, target_id, note, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, left(nullif(btrim(coalesce(p_note, '')), ''), 500),
          coalesce(p_details, '{}'))
$$;

-- Moderation bookkeeping: a hidden post leaves the queue once staff decided on it.
alter table public.threads  add column moderated_at timestamptz;
alter table public.comments add column moderated_at timestamptz;

-- Overview ---------------------------------------------------------------------------------------------------------------
create function public.admin_overview()
returns table (
  pending_events          int,
  pending_accounts        int,
  safety_seals            int,
  hidden_posts            int,
  open_safety_reports     int,
  oldest_safety_report_at timestamptz
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
      where k.status = 'open');
end $$;

-- Festas -------------------------------------------------------------------------------------------------------------------
create function public.admin_pending_events()
returns table (
  id            uuid,
  title         text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  venue_name    text,
  venue_slug    text,
  account_name  text,
  is_free       boolean,
  price_min     numeric,
  price_max     numeric,
  ticket_url    text,
  age_min       int,
  dress_code    text,
  poster_path   text,
  genre_slugs   text[],
  submitted_at  timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
    select e.id, e.title, e.starts_at, e.ends_at, v.name, v.slug, a.legal_name, e.is_free, e.price_min, e.price_max,
           e.ticket_url, e.age_min, e.dress_code, e.poster_path,
           coalesce((select array_agg(g.genre_slug order by g.genre_slug) from public.event_genres g where g.event_id = e.id),
                    '{}'::text[]),
           e.created_at
    from public.events e
    join public.venues v on v.id = e.venue_id
    left join public.venue_accounts a on a.id = e.venue_account_id
    where e.status = 'pending_review'
    order by e.starts_at, e.created_at;
end $$;

create function public.admin_review_event(p_event_id uuid, p_approve boolean, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_state text;
begin
  perform public.require_staff();
  if p_approve is null then perform public.venue_error('invalid_payload', 'approve'); end if;
  -- A refusal tells the casa why (it reads review_note in its painel).
  if not p_approve and char_length(btrim(coalesce(p_note, ''))) < 3 then perform public.venue_error('note_required'); end if;
  v_state := public.review_event(p_event_id, p_approve, p_note);
  perform public.admin_log(case when p_approve then 'event_approve' else 'event_reject' end, 'event', p_event_id, p_note);
  return v_state;
end $$;

create function public.admin_verify_event(p_event_id uuid) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare
  v_at timestamptz;
begin
  perform public.require_staff();
  v_at := public.verify_event(p_event_id);
  perform public.admin_log('event_verify', 'event', p_event_id, null);
  return v_at;
end $$;

-- Casas ----------------------------------------------------------------------------------------------------------------------
create function public.admin_pending_accounts()
returns table (
  id              uuid,
  venue_id        uuid,
  venue_name      text,
  proposed_venue  jsonb,
  cnpj            text,
  legal_name      text,
  contact_name    text,
  whatsapp        text,
  created_at      timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
    select a.id, a.venue_id, v.name, a.proposed_venue, a.cnpj, a.legal_name, a.contact_name, a.whatsapp, a.created_at
    from public.venue_accounts a
    left join public.venues v on v.id = a.venue_id
    where a.status = 'pending'
    order by a.created_at;
end $$;

-- Approve: the account must end up linked to a venue. It already has one (claimed from the catalog), or staff names an
-- existing venue (p_venue_id), or the venue is created from the proposal (needs lat and lng in it). Reject needs a note.
create function public.admin_review_account(
  p_account   uuid,
  p_approve   boolean,
  p_note      text default null,
  p_venue_id  uuid default null
) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  acc public.venue_accounts%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_venue uuid;
  v_name text;
  v_base text;
  v_slug text;
  n int := 1;
  v_created boolean := false;
begin
  perform public.require_staff();
  if p_approve is null then perform public.venue_error('invalid_payload', 'approve'); end if;
  select * into acc from public.venue_accounts where id = p_account for update;
  if not found then perform public.venue_error('account_not_found'); end if;
  if acc.status <> 'pending' then perform public.venue_error('not_pending'); end if;

  if not p_approve then
    if char_length(coalesce(v_note, '')) < 3 then perform public.venue_error('note_required'); end if;
    update public.venue_accounts set status = 'rejected', review_note = left(v_note, 500), updated_at = now()
     where id = p_account;
    perform public.admin_log('account_reject', 'venue_account', p_account, v_note);
    return 'rejected';
  end if;

  v_venue := coalesce(acc.venue_id, p_venue_id);
  if v_venue is not null then
    if not exists (select 1 from public.venues where id = v_venue) then perform public.venue_error('venue_not_found'); end if;
    if exists (select 1 from public.venue_accounts o
               where o.venue_id = v_venue and o.id <> p_account and o.status <> 'rejected') then
      perform public.venue_error('venue_taken');
    end if;
  else
    if jsonb_typeof(acc.proposed_venue->'lat') is distinct from 'number'
       or jsonb_typeof(acc.proposed_venue->'lng') is distinct from 'number' then
      perform public.venue_error('venue_location_missing');
    end if;
    v_name := btrim(acc.proposed_venue->>'name');
    v_base := nullif(btrim(regexp_replace(public.fold_text(v_name), '[^a-z0-9]+', '-', 'g'), '-'), '');
    v_base := left(coalesce(v_base, 'casa'), 60);
    v_slug := v_base;
    while exists (select 1 from public.venues where slug = v_slug) loop
      n := n + 1;
      v_slug := v_base || '-' || n;
    end loop;
    insert into public.venues (slug, name, area, city, address, lat, lng, status, placeholder)
    values (v_slug, v_name,
            coalesce(nullif(btrim(acc.proposed_venue->>'area'), ''), nullif(btrim(acc.proposed_venue->>'city'), ''), 'Vitória'),
            coalesce(nullif(btrim(acc.proposed_venue->>'city'), ''), 'Vitória'),
            btrim(acc.proposed_venue->>'address'),
            (acc.proposed_venue->>'lat')::double precision, (acc.proposed_venue->>'lng')::double precision,
            'open', false)
    returning id into v_venue;
    v_created := true;
  end if;

  update public.venue_accounts
     set status = 'verified', venue_id = v_venue, review_note = left(v_note, 500), updated_at = now()
   where id = p_account;
  perform public.admin_log('account_verify', 'venue_account', p_account, v_note,
                           jsonb_build_object('venue_id', v_venue, 'venue_created', v_created));
  return 'verified';
exception when unique_violation then
  perform public.venue_error('venue_taken');
end $$;

-- Selo S1 ------------------------------------------------------------------------------------------------------------------------
-- Contested seals first, then declarations nobody has reviewed yet. reports_90d: safety reports at the venue (S3).
create function public.admin_safety_queue()
returns table (
  venue_id          uuid,
  venue_name        text,
  venue_slug        text,
  state             text,
  state_at          timestamptz,
  responsible_name  text,
  evidence_path     text,
  declared_at       timestamptz,
  reports_90d       int
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
    select v.id, v.name, v.slug, v.safety_protocol, v.safety_protocol_at, d.responsible_name, d.evidence_path,
           d.declared_at,
           (select count(*)::int from public.safety_reports r
             where r.venue_id = v.id and r.created_at > now() - interval '90 days')
    from public.venues v
    left join public.venue_safety_declarations d on d.venue_id = v.id
    where v.safety_protocol = 'contested'
       or (v.safety_protocol = 'declared' and d.reviewed_at is null)
    order by (v.safety_protocol = 'contested') desc, v.safety_protocol_at;
end $$;

create function public.admin_review_safety(p_venue_id uuid, p_decision text, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_state text;
begin
  perform public.require_staff();
  if p_decision in ('reject', 'contest') and char_length(btrim(coalesce(p_note, ''))) < 3 then
    perform public.venue_error('note_required');
  end if;
  v_state := public.review_safety_protocol(p_venue_id, p_decision, p_note);
  perform public.admin_log('safety_' || p_decision, 'venue', p_venue_id, p_note);
  return v_state;
end $$;

-- Moderação ----------------------------------------------------------------------------------------------------------------------
-- Hidden posts (auto-hidden by reports, 0010/0017) that staff has not decided on yet, oldest first.
create function public.admin_hidden_posts()
returns table (
  kind          text,
  id            uuid,
  thread_id     uuid,
  title         text,
  body          text,
  anonymous     boolean,
  created_at    timestamptz,
  report_count  int,
  reasons       text[]
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
    select * from (
      select 'thread'::text, t.id, t.id, t.title, t.body, t.anonymous, t.created_at,
             (select count(*)::int from public.community_reports r where r.thread_id = t.id),
             coalesce((select array_agg(r.reason order by r.created_at) from public.community_reports r where r.thread_id = t.id),
                      '{}'::text[])
      from public.threads t where t.status = 'hidden' and t.moderated_at is null
      union all
      select 'comment'::text, c.id, c.thread_id, null::text, c.body, c.anonymous, c.created_at,
             (select count(*)::int from public.community_reports r where r.comment_id = c.id),
             coalesce((select array_agg(r.reason order by r.created_at) from public.community_reports r where r.comment_id = c.id),
                      '{}'::text[])
      from public.comments c where c.status = 'hidden' and c.moderated_at is null
    ) q
    order by q.created_at;
end $$;

-- restore: the post is published again and its reports are cleared, so the same reports cannot hide it a second time
-- (new reports still can). keep_hidden: stays hidden and leaves the queue.
create function public.admin_moderate(p_kind text, p_id uuid, p_action text, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_reports int;
begin
  perform public.require_staff();
  if p_kind not in ('thread', 'comment') then perform public.venue_error('invalid_payload', 'kind'); end if;
  if p_action not in ('restore', 'keep_hidden') then perform public.venue_error('invalid_payload', 'action'); end if;
  if p_kind = 'thread' then
    if not exists (select 1 from public.threads where id = p_id and status = 'hidden') then perform public.venue_error('post_not_hidden'); end if;
    if p_action = 'restore' then
      delete from public.community_reports where thread_id = p_id;
      get diagnostics v_reports = row_count;
    end if;
    update public.threads
       set status = case when p_action = 'restore' then 'published' else 'hidden' end::public.community_status,
           moderated_at = now()
     where id = p_id;
  else
    if not exists (select 1 from public.comments where id = p_id and status = 'hidden') then perform public.venue_error('post_not_hidden'); end if;
    if p_action = 'restore' then
      delete from public.community_reports where comment_id = p_id;
      get diagnostics v_reports = row_count;
    end if;
    update public.comments
       set status = case when p_action = 'restore' then 'published' else 'hidden' end::public.community_status,
           moderated_at = now()
     where id = p_id;
  end if;
  perform public.admin_log('post_' || p_action, p_kind, p_id, p_note,
                           case when v_reports is null then '{}'::jsonb else jsonb_build_object('reports_cleared', v_reports) end);
  return case when p_action = 'restore' then 'published' else 'hidden' end;
end $$;

-- Relatos de segurança (S3) -------------------------------------------------------------------------------------------------------
-- Open ones first (oldest first: the SLA in S9 is 12 h), then the last 30 days of answered/closed ones.
-- The reporter's identity is not returned: the team answers in the ticket, which reaches the person in Mensagens.
create function public.admin_safety_reports()
returns table (
  ticket_id      uuid,
  venue_id       uuid,
  venue_name     text,
  event_title    text,
  kind           text,
  checked_in     boolean,
  description    text,
  ticket_status  text,
  created_at     timestamptz,
  messages       jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
    select r.ticket_id, r.venue_id, v.name, e.title, r.kind, r.checked_in, k.description, k.status::text, r.created_at,
           coalesce((select jsonb_agg(jsonb_build_object('sender', m.sender, 'text', m.text, 'at', m.created_at)
                                      order by m.created_at)
                     from public.support_messages m where m.ticket_id = k.id), '[]'::jsonb)
    from public.safety_reports r
    join public.support_tickets k on k.id = r.ticket_id
    join public.venues v on v.id = r.venue_id
    left join public.events e on e.id = r.event_id
    where k.status = 'open' or r.created_at > now() - interval '30 days'
    order by (k.status = 'open') desc, r.created_at;
end $$;

-- Answers a safety ticket as the team. p_close closes it (the person can still write back, which reopens it).
create function public.admin_reply_ticket(p_ticket_id uuid, p_text text, p_close boolean default false) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_text text := btrim(coalesce(p_text, ''));
  v_status public.ticket_status;
begin
  perform public.require_staff();
  if not exists (select 1 from public.safety_reports r where r.ticket_id = p_ticket_id) then
    perform public.venue_error('ticket_not_found');
  end if;
  if char_length(v_text) not between 1 and 4000 then perform public.venue_error('invalid_payload', 'text'); end if;
  insert into public.support_messages (ticket_id, sender, text) values (p_ticket_id, 'support', v_text);
  v_status := case when coalesce(p_close, false) then 'closed' else 'answered' end;
  update public.support_tickets set status = v_status where id = p_ticket_id;
  -- The message text stays in the ticket; the log keeps only that it was answered.
  perform public.admin_log(case when coalesce(p_close, false) then 'ticket_close' else 'ticket_reply' end,
                           'ticket', p_ticket_id, null);
  return v_status::text;
end $$;

-- Log --------------------------------------------------------------------------------------------------------------------------------
create function public.admin_recent_actions(p_limit int default 50)
returns table (
  id           uuid,
  actor_id     uuid,
  actor_name   text,
  action       text,
  target_type  text,
  target_id    uuid,
  note         text,
  details      jsonb,
  created_at   timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return query
    select x.id, x.actor_id, coalesce(p.display_name, p.handle), x.action, x.target_type, x.target_id, x.note, x.details,
           x.created_at
    from public.admin_actions x
    left join public.profiles p on p.id = x.actor_id
    order by x.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

-- Storage: staff read festa posters and seal photos ------------------------------------------------------------------------------
create policy event_posters_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'event-posters' and public.is_staff());

-- Privileges -------------------------------------------------------------------------------------------------------------------------
revoke execute on function
  public.is_staff(), public.require_staff(), public.admin_log(text, text, uuid, text, jsonb), public.admin_overview(),
  public.admin_pending_events(), public.admin_review_event(uuid, boolean, text), public.admin_verify_event(uuid),
  public.admin_pending_accounts(), public.admin_review_account(uuid, boolean, text, uuid), public.admin_safety_queue(),
  public.admin_review_safety(uuid, text, text), public.admin_hidden_posts(), public.admin_moderate(text, uuid, text, text),
  public.admin_safety_reports(), public.admin_reply_ticket(uuid, text, boolean), public.admin_recent_actions(int)
  from public, anon;
-- admin_log and require_staff are internal; is_staff is also called by the storage policy (as the caller).
revoke execute on function public.admin_log(text, text, uuid, text, jsonb), public.require_staff() from authenticated;
grant execute on function
  public.is_staff(), public.admin_overview(), public.admin_pending_events(), public.admin_review_event(uuid, boolean, text),
  public.admin_verify_event(uuid), public.admin_pending_accounts(), public.admin_review_account(uuid, boolean, text, uuid),
  public.admin_safety_queue(), public.admin_review_safety(uuid, text, text), public.admin_hidden_posts(),
  public.admin_moderate(text, uuid, text, text), public.admin_safety_reports(), public.admin_reply_ticket(uuid, text, boolean),
  public.admin_recent_actions(int)
  to authenticated;

comment on table public.staff_members is 'Equipe do Qual a boa? (acesso a /admin). Only service_role writes it. See 0024.';
comment on table public.admin_actions is 'Audit log of /admin decisions, written by the admin_* functions (0024).';
