-- 0010_community.sql
-- Comunidade: event/venue-scoped threads, comments (depth <= 1), helpful votes, reports.
-- Mirrors app/src/domain/community.ts. Same privacy model as reviews (0005): user_id is never
-- selectable by clients, so anonymous posts stay anonymous; threads_feed / comments_feed are the
-- public read path and only reveal the handle when the post is not anonymous.

create type public.thread_kind as enum ('vale_a_pena', 'grupo', 'agora');
create type public.community_status as enum ('published', 'hidden');

-- Handle (public @name) on the owner-only profiles table; exposed only through the feed views.
alter table public.profiles
  add column handle      text unique check (handle ~ '^[a-z0-9_.]{3,20}$'),
  add column avatar_hue  smallint check (avatar_hue between 0 and 359);

-- Tables ---------------------------------------------------------------------
create table public.threads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id    uuid references public.events (id) on delete cascade,
  venue_id    uuid references public.venues (id) on delete cascade,
  kind        public.thread_kind not null,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  body        text check (body is null or char_length(body) <= 800),
  anonymous   boolean not null default false,
  status      public.community_status not null default 'published',
  created_at  timestamptz not null default now(),
  constraint threads_one_scope check ((event_id is null) <> (venue_id is null))
);
create index threads_event_idx on public.threads (event_id, status, created_at desc);
create index threads_venue_idx on public.threads (venue_id, status, created_at desc);
create index threads_created_idx on public.threads (created_at desc);

create table public.comments (
  id             uuid primary key default gen_random_uuid(),
  thread_id      uuid not null references public.threads (id) on delete cascade,
  parent_id      uuid references public.comments (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body           text not null check (char_length(btrim(body)) between 1 and 500),
  anonymous      boolean not null default false,
  status         public.community_status not null default 'published',
  helpful_count  int not null default 0 check (helpful_count >= 0),
  created_at     timestamptz not null default now()
);
create index comments_thread_idx on public.comments (thread_id, status, created_at);
create index comments_parent_idx on public.comments (parent_id);

-- One "Útil" per (user, comment); no downvotes.
create table public.comment_votes (
  comment_id  uuid not null references public.comments (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- Reports ("Denunciar"): exactly one target, one report per user per target.
create table public.community_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id   uuid references public.threads (id) on delete cascade,
  comment_id  uuid references public.comments (id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 500),
  created_at  timestamptz not null default now(),
  constraint community_reports_one_target check ((thread_id is null) <> (comment_id is null))
);
create unique index community_reports_user_thread_uq on public.community_reports (user_id, thread_id)
  where thread_id is not null;
create unique index community_reports_user_comment_uq on public.community_reports (user_id, comment_id)
  where comment_id is not null;

-- Triggers (definer, so they see rows RLS hides from the caller) ---------------
-- Posting by name needs a handle on the profile; anonymous posts do not.
create function public.community_require_handle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.anonymous and not exists (
    select 1 from public.profiles p where p.id = new.user_id and p.handle is not null
  ) then
    raise exception 'a handle is required to post by name' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger threads_require_handle before insert on public.threads
  for each row execute function public.community_require_handle();
create trigger comments_require_handle before insert on public.comments
  for each row execute function public.community_require_handle();

-- Nesting is capped at one reply level, and a reply stays inside its thread.
create function public.comments_check_parent() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.comments;
begin
  if new.parent_id is not null then
    select * into p from public.comments where id = new.parent_id;
    if not found or p.thread_id <> new.thread_id then
      raise exception 'parent comment must belong to the same thread' using errcode = '23514';
    end if;
    if p.parent_id is not null then
      raise exception 'replies cannot be nested more than one level' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger comments_parent_check before insert on public.comments
  for each row execute function public.comments_check_parent();

create function public.comment_votes_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set helpful_count = helpful_count + 1 where id = new.comment_id;
  else
    update public.comments set helpful_count = greatest(helpful_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end $$;
create trigger comment_votes_count after insert or delete on public.comment_votes
  for each row execute function public.comment_votes_sync();

-- Auto-hide: 3 distinct reporters hide a thread or comment (service_role can republish).
create function public.community_reports_autohide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.thread_id is not null then
    if (select count(distinct user_id) from public.community_reports where thread_id = new.thread_id) >= 3 then
      update public.threads set status = 'hidden' where id = new.thread_id;
    end if;
  else
    if (select count(distinct user_id) from public.community_reports where comment_id = new.comment_id) >= 3 then
      update public.comments set status = 'hidden' where id = new.comment_id;
    end if;
  end if;
  return null;
end $$;
create trigger community_reports_hide after insert on public.community_reports
  for each row execute function public.community_reports_autohide();

-- Vote/report eligibility: published, not your own. Definer because user_id is not selectable.
-- Must stay executable by authenticated (RLS policies call them as the caller).
create function public.can_vote_comment(p_comment_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.comments c
                 where c.id = p_comment_id and c.status = 'published'
                   and c.user_id is distinct from auth.uid())
$$;
create function public.can_report_thread(p_thread_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.threads t
                 where t.id = p_thread_id and t.status = 'published'
                   and t.user_id is distinct from auth.uid())
$$;
revoke execute on function public.can_vote_comment(uuid), public.can_report_thread(uuid) from public, anon;
grant execute on function public.can_vote_comment(uuid), public.can_report_thread(uuid)
  to authenticated, service_role;

revoke execute on function public.community_require_handle(), public.comments_check_parent(),
  public.comment_votes_sync(), public.community_reports_autohide()
  from public, anon, authenticated;

-- RLS ------------------------------------------------------------------------
alter table public.threads            enable row level security;
alter table public.comments           enable row level security;
alter table public.comment_votes      enable row level security;
alter table public.community_reports  enable row level security;

revoke all on public.threads, public.comments, public.comment_votes, public.community_reports
  from anon, authenticated;

-- user_id stays private: column-level select only. Content is immutable once posted (delete only).
grant select (id, event_id, venue_id, kind, title, body, anonymous, status, created_at)
  on public.threads to anon, authenticated;
grant insert (event_id, venue_id, user_id, kind, title, body, anonymous) on public.threads to authenticated;
grant delete on public.threads to authenticated;

grant select (id, thread_id, parent_id, body, anonymous, status, helpful_count, created_at)
  on public.comments to anon, authenticated;
grant insert (thread_id, parent_id, user_id, body, anonymous) on public.comments to authenticated;
grant delete on public.comments to authenticated;

grant select, insert, delete on public.comment_votes to authenticated;
grant select on public.community_reports to authenticated;
grant insert (thread_id, comment_id, user_id, reason) on public.community_reports to authenticated;
grant all on all tables in schema public to service_role;

-- threads
create policy threads_public_read on public.threads
  for select to anon, authenticated using (status = 'published');
create policy threads_owner_read on public.threads
  for select to authenticated using (user_id = (select auth.uid()));
create policy threads_owner_insert on public.threads
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and (event_id is null or exists (select 1 from public.events e
                                               where e.id = threads.event_id and e.status = 'published')));
create policy threads_owner_delete on public.threads
  for delete to authenticated using (user_id = (select auth.uid()));

-- comments (readable only while their thread is)
create policy comments_public_read on public.comments
  for select to anon, authenticated
  using (status = 'published'
         and exists (select 1 from public.threads t where t.id = comments.thread_id and t.status = 'published'));
create policy comments_owner_read on public.comments
  for select to authenticated using (user_id = (select auth.uid()));
create policy comments_owner_insert on public.comments
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.threads t where t.id = comments.thread_id and t.status = 'published'));
create policy comments_owner_delete on public.comments
  for delete to authenticated using (user_id = (select auth.uid()));

-- helpful votes: one per (user, comment), only on published comments that are not yours
create policy comment_votes_owner_select on public.comment_votes
  for select to authenticated using (user_id = (select auth.uid()));
create policy comment_votes_owner_insert on public.comment_votes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_vote_comment(comment_id));
create policy comment_votes_owner_delete on public.comment_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- reports: owner-only, one per (user, target), not on your own content
create policy community_reports_owner_select on public.community_reports
  for select to authenticated using (user_id = (select auth.uid()));
create policy community_reports_owner_insert on public.community_reports
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and ((thread_id is not null and public.can_report_thread(thread_id))
                   or (comment_id is not null and public.can_vote_comment(comment_id))));

-- Views ----------------------------------------------------------------------
-- Feed rows: published threads + the caller's own. The handle shows only for non-anonymous posts.
-- top_comment_*: the pinned "Mais útil" reply = most helpful top-level comment with >= 3 votes
-- (mirrors TOP_HELPFUL_MIN in app/src/domain/community.ts); ties go to the newest.
-- archived: `agora` threads of an event that has ended (ends_at, else start + 8h as in check-ins).
create view public.threads_feed with (security_invoker = false) as
  select t.id, t.event_id, t.venue_id,
         coalesce(e.title, v.name) as event_name,
         coalesce(ev.slug, v.slug) as venue_slug,
         t.kind, t.title, t.body, t.anonymous,
         case when t.anonymous then null else p.handle end as handle,
         case when t.anonymous then null else p.avatar_hue end as avatar_hue,
         t.status,
         (select count(*)::int from public.comments c
           where c.thread_id = t.id and c.status = 'published') as comment_count,
         t.created_at,
         coalesce(t.user_id = (select auth.uid()), false) as mine,
         (t.kind = 'agora' and e.id is not null
            and coalesce(e.ends_at, e.starts_at + interval '8 hours') < now()) as archived,
         top.id as top_comment_id, top.body as top_comment_body, top.helpful_count as top_comment_votes
  from public.threads t
  left join public.events e on e.id = t.event_id
  left join public.venues ev on ev.id = e.venue_id
  left join public.venues v on v.id = t.venue_id
  left join public.profiles p on p.id = t.user_id
  left join lateral (
    select c.id, c.body, c.helpful_count from public.comments c
    where c.thread_id = t.id and c.parent_id is null and c.status = 'published' and c.helpful_count >= 3
    order by c.helpful_count desc, c.created_at desc limit 1
  ) top on true
  where t.status = 'published' or t.user_id = (select auth.uid());

create view public.comments_feed with (security_invoker = false) as
  select c.id, c.thread_id, c.parent_id, c.body, c.anonymous,
         case when c.anonymous then null else p.handle end as handle,
         case when c.anonymous then null else p.avatar_hue end as avatar_hue,
         c.status, c.helpful_count, c.created_at,
         coalesce(c.user_id = (select auth.uid()), false) as mine,
         exists (select 1 from public.comment_votes cv
                 where cv.comment_id = c.id and cv.user_id = (select auth.uid())) as voted
  from public.comments c
  join public.threads t on t.id = c.thread_id
  left join public.profiles p on p.id = c.user_id
  where (c.status = 'published' or c.user_id = (select auth.uid()))
    and (t.status = 'published' or t.user_id = (select auth.uid()));

revoke all on public.threads_feed, public.comments_feed from anon, authenticated;
grant select on public.threads_feed, public.comments_feed to anon, authenticated;
