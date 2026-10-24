-- 0005_engage.sql
-- Wave 3 engagement: follows (tracking + alert prefs), checkins, live reports,
-- reviews (+ helpful votes), support tickets/messages. Mirrors app/src/domain/engage.ts.
-- Naming notes: SupportMessage.from -> column `sender` ("from" is reserved);
-- timestamps `at`/`createdAt` -> created_at (checkins: `at`).

create type public.queue_level as enum ('none', 'short', 'long');
create type public.crowd_level as enum ('empty', 'busy', 'full');
create type public.music_level as enum ('warmup', 'good', 'peak');
create type public.review_status as enum ('pending', 'published', 'hidden');
create type public.ticket_status as enum ('open', 'answered', 'closed');

-- Tables ---------------------------------------------------------------------
create table public.event_follows (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id     uuid not null references public.events (id) on delete cascade,
  followed_at  timestamptz not null default now(),
  has_ticket   boolean not null default false,
  alerts       jsonb not null default '{"price":true,"lineup":true,"lastTickets":true,"dayBefore":true,"cancelled":true}'
               check (jsonb_typeof(alerts) = 'object'),
  channels     jsonb not null default '{"push":true,"email":false}'
               check (jsonb_typeof(channels) = 'object'),
  primary key (user_id, event_id)
);
create index event_follows_event_idx on public.event_follows (event_id);

create table public.checkins (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id  uuid not null references public.events (id) on delete cascade,
  at        timestamptz not null default now()
);
create index checkins_user_event_idx on public.checkins (user_id, event_id, at desc);
create index checkins_event_idx on public.checkins (event_id);

create table public.event_reports (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  queue          public.queue_level,
  crowd          public.crowd_level,
  music          public.music_level,
  price_at_door  numeric(10,2) check (price_at_door >= 0),
  constraint event_reports_has_value
    check (queue is not null or crowd is not null or music is not null or price_at_door is not null)
);
create index event_reports_event_created_idx on public.event_reports (event_id, created_at desc);

create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id       uuid not null references public.events (id) on delete cascade,
  rating         int not null check (rating between 1 and 5),
  topics         jsonb not null default '{}' check (jsonb_typeof(topics) = 'object'),
  tags           text[] not null default '{}',
  text           text check (text is null or char_length(text) <= 2000),
  anonymous      boolean not null default false,
  attended       boolean not null default false,
  status         public.review_status not null default 'pending',
  helpful_count  int not null default 0 check (helpful_count >= 0),
  created_at     timestamptz not null default now(),
  constraint reviews_one_per_user_event unique (user_id, event_id)
);
create index reviews_event_status_idx on public.reviews (event_id, status);

create table public.review_votes (
  review_id   uuid not null references public.reviews (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic        text not null check (topic in ('ingresso','conta','evento','casa','seguranca','outro')),
  event_id     uuid references public.events (id) on delete set null,
  description  text not null check (char_length(description) between 1 and 4000),
  status       public.ticket_status not null default 'open',
  created_at   timestamptz not null default now()
);
create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);

create table public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets (id) on delete cascade,
  sender      text not null check (sender in ('user','support')),
  text        text not null check (char_length(text) between 1 and 4000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- Triggers (definer, so they see rows RLS hides from the caller) ---------------
create function public.reviews_check_attended() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.attended and not exists (
    select 1 from public.checkins c where c.user_id = new.user_id and c.event_id = new.event_id
  ) then
    raise exception 'attended review requires a check-in' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger reviews_attended_check before insert or update on public.reviews
  for each row execute function public.reviews_check_attended();

create function public.review_votes_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews set helpful_count = helpful_count + 1 where id = new.review_id;
  else
    update public.reviews set helpful_count = greatest(helpful_count - 1, 0) where id = old.review_id;
  end if;
  return null;
end $$;
create trigger review_votes_count after insert or delete on public.review_votes
  for each row execute function public.review_votes_sync();
revoke execute on function public.reviews_check_attended(), public.review_votes_sync() from public;

-- RLS ------------------------------------------------------------------------
alter table public.event_follows    enable row level security;
alter table public.checkins         enable row level security;
alter table public.event_reports    enable row level security;
alter table public.reviews          enable row level security;
alter table public.review_votes     enable row level security;
alter table public.support_tickets  enable row level security;
alter table public.support_messages enable row level security;

-- Privileges (tighten Supabase defaults; column grants keep server-owned fields read-only).
revoke all on public.event_follows, public.checkins, public.event_reports, public.reviews,
              public.review_votes, public.support_tickets, public.support_messages
  from anon, authenticated;

grant select, insert, update, delete on public.event_follows to authenticated;
grant select, delete on public.checkins to authenticated;
grant insert (event_id, user_id) on public.checkins to authenticated;
grant select on public.event_reports to anon, authenticated;
grant insert (event_id, user_id, queue, crowd, music, price_at_door) on public.event_reports to authenticated;
-- reviews: user_id is not readable by clients (anonymous reviews); use reviews_feed for `mine`.
grant select (id, event_id, rating, topics, tags, text, anonymous, attended, status, helpful_count, created_at)
  on public.reviews to anon, authenticated;
grant insert (event_id, user_id, rating, topics, tags, text, anonymous, attended) on public.reviews to authenticated;
grant update (rating, topics, tags, text, anonymous) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
grant select, insert, delete on public.review_votes to authenticated;
grant select, delete on public.support_tickets to authenticated;
grant insert (user_id, topic, event_id, description) on public.support_tickets to authenticated;
grant update (status) on public.support_tickets to authenticated;
grant select on public.support_messages to authenticated;
grant insert (ticket_id, sender, text) on public.support_messages to authenticated;
grant update (read_at) on public.support_messages to authenticated;
grant all on all tables in schema public to service_role;

-- follows
create policy event_follows_owner_select on public.event_follows
  for select to authenticated using (user_id = (select auth.uid()));
create policy event_follows_owner_insert on public.event_follows
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy event_follows_owner_update on public.event_follows
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy event_follows_owner_delete on public.event_follows
  for delete to authenticated using (user_id = (select auth.uid()));

-- checkins (event must be published; `at` is server time)
create policy checkins_owner_select on public.checkins
  for select to authenticated using (user_id = (select auth.uid()));
create policy checkins_owner_insert on public.checkins
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy checkins_owner_delete on public.checkins
  for delete to authenticated using (user_id = (select auth.uid()));

-- live reports: public read for 24h; insert needs a check-in in the last 6h
create policy event_reports_recent_read on public.event_reports
  for select to anon, authenticated using (created_at > now() - interval '24 hours');
create policy event_reports_checked_in_insert on public.event_reports
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.checkins c
                          where c.user_id = (select auth.uid()) and c.event_id = event_reports.event_id
                            and c.at > now() - interval '6 hours'));

-- reviews (attended=true is also enforced by trigger so it holds for any writer)
create policy reviews_public_read on public.reviews
  for select to anon, authenticated using (status = 'published');
create policy reviews_owner_read on public.reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy reviews_owner_insert on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and (not attended or exists (select 1 from public.checkins c
                                           where c.user_id = (select auth.uid()) and c.event_id = reviews.event_id)));
create policy reviews_owner_update on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reviews_owner_delete on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()));

-- helpful votes: one per (user, review), only on reviews you can see
create policy review_votes_owner_select on public.review_votes
  for select to authenticated using (user_id = (select auth.uid()));
create policy review_votes_owner_insert on public.review_votes
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.reviews r where r.id = review_id));
create policy review_votes_owner_delete on public.review_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- support
create policy support_tickets_owner_select on public.support_tickets
  for select to authenticated using (user_id = (select auth.uid()));
create policy support_tickets_owner_insert on public.support_tickets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy support_tickets_owner_update on public.support_tickets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status = 'closed');
create policy support_tickets_owner_delete on public.support_tickets
  for delete to authenticated using (user_id = (select auth.uid()));

create policy support_messages_owner_select on public.support_messages
  for select to authenticated
  using (exists (select 1 from public.support_tickets t
                 where t.id = ticket_id and t.user_id = (select auth.uid())));
create policy support_messages_owner_insert on public.support_messages
  for insert to authenticated
  with check (sender = 'user'
              and exists (select 1 from public.support_tickets t
                          where t.id = ticket_id and t.user_id = (select auth.uid())));
create policy support_messages_owner_read_mark on public.support_messages
  for update to authenticated
  using (exists (select 1 from public.support_tickets t
                 where t.id = ticket_id and t.user_id = (select auth.uid())))
  with check (exists (select 1 from public.support_tickets t
                      where t.id = ticket_id and t.user_id = (select auth.uid())));

-- Views / functions ----------------------------------------------------------
-- Review feed: published reviews + the caller's own, never exposing user_id.
create view public.reviews_feed with (security_invoker = false) as
  select r.id, r.event_id, r.rating, r.topics, r.tags, r.text, r.anonymous, r.attended,
         r.status, r.helpful_count, r.created_at,
         coalesce(r.user_id = (select auth.uid()), false) as mine
  from public.reviews r
  where r.status = 'published' or r.user_id = (select auth.uid());
revoke all on public.reviews_feed from anon, authenticated;
grant select on public.reviews_feed to anon, authenticated;

-- Latest value per dimension over the last 24h, sample size and age (seconds) of the newest report.
create function public.event_live_summary(p_event_id uuid, p_now timestamptz default now())
returns table (
  event_id uuid, queue public.queue_level, crowd public.crowd_level, music public.music_level,
  price_at_door numeric, sample_size int, last_report_at timestamptz, age_seconds int
)
language sql stable security invoker set search_path = public as $$
  with recent as (
    select * from public.event_reports r
    where r.event_id = p_event_id and r.created_at > p_now - interval '24 hours' and r.created_at <= p_now
  )
  select p_event_id,
    (select x.queue from recent x where x.queue is not null order by x.created_at desc limit 1),
    (select x.crowd from recent x where x.crowd is not null order by x.created_at desc limit 1),
    (select x.music from recent x where x.music is not null order by x.created_at desc limit 1),
    (select x.price_at_door from recent x where x.price_at_door is not null order by x.created_at desc limit 1),
    (select count(*)::int from recent),
    (select max(x.created_at) from recent x),
    (select extract(epoch from p_now - max(x.created_at))::int from recent x)
$$;
revoke execute on function public.event_live_summary(uuid, timestamptz) from public;
grant execute on function public.event_live_summary(uuid, timestamptz) to anon, authenticated, service_role;
