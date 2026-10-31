-- 0013_community_state.sql
-- The Comunidade is about the user's state (UF). Venues carry their state; every thread inherits it, set by the server
-- (a client cannot choose it), and the feed filters on it. During the pilot every venue is in Espírito Santo, so the
-- default 'ES' backfills existing rows and nothing changes for users yet.

alter table public.venues
  add column uf char(2) not null default 'ES' check (uf ~ '^[A-Z]{2}$');

-- threads.uf is denormalised from the venue so a state's feed can read newest-first straight from one index and stop
-- after ~21 rows; filtering on the joined venue would scan every thread of the other states first.
alter table public.threads
  add column uf char(2) not null default 'ES' check (uf ~ '^[A-Z]{2}$');

-- Backfill (no-op for the pilot: every venue is ES).
update public.threads t
   set uf = coalesce(
     (select v.uf from public.events e join public.venues v on v.id = e.venue_id where e.id = t.event_id),
     (select v.uf from public.venues v where v.id = t.venue_id),
     'ES');

-- The state comes from the event's venue, or the thread's own venue. Whatever the client sent is ignored (the column
-- is not insertable anyway: see the column grants in 0010).
create function public.threads_set_uf() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.uf := coalesce(
    (select v.uf from public.events e join public.venues v on v.id = e.venue_id where e.id = new.event_id),
    (select v.uf from public.venues v where v.id = new.venue_id),
    'ES');
  return new;
end $$;
create trigger threads_set_uf_before_insert before insert on public.threads
  for each row execute function public.threads_set_uf();
revoke execute on function public.threads_set_uf() from public, anon, authenticated;

create index threads_feed_uf_idx on public.threads (uf, created_at desc, id desc);

-- threads_feed gains `uf` as its LAST column (create or replace may only append). Otherwise identical to 0011.
create or replace view public.threads_feed with (security_invoker = false) as
  select t.id, t.event_id, t.venue_id,
         coalesce(e.title, v.name) as event_name,
         coalesce(ev.slug, v.slug) as venue_slug,
         t.kind, t.title, t.body, t.anonymous,
         case when t.anonymous then null else p.handle end as handle,
         case when t.anonymous then null else p.avatar_hue end as avatar_hue,
         t.status,
         (select count(*)::int from public.comments c
           where c.thread_id = t.id and c.status = 'published'
             and (c.parent_id is null
                  or exists (select 1 from public.comments pc
                             where pc.id = c.parent_id and pc.status = 'published'))) as comment_count,
         t.created_at,
         coalesce(t.user_id = (select auth.uid()), false) as mine,
         (t.kind = 'agora' and e.id is not null
            and coalesce(e.ends_at, e.starts_at + interval '8 hours') < now()) as archived,
         top.id as top_comment_id, top.body as top_comment_body, top.helpful_count as top_comment_votes,
         t.uf as uf
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
