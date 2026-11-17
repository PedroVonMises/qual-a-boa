-- 0016_user_blocks.sql
-- Bloquear usuária (App Store guideline 1.2 for user-generated content; item B8 of docs/MVP-PLANO.md).
-- A block is made from a post, never from a user id: clients cannot see who wrote a post (0010), and anonymous posts
-- must stay anonymous, so block_author() resolves the author on the server. The blocker can count and lift their
-- blocks but never learns the blocked user's id. Blocked authors' threads and comments (including the pinned "Mais
-- útil" preview and the reply counts) disappear from the blocker's threads_feed / comments_feed.

create table public.user_blocks (
  blocker_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
-- The views look blocks up by blocker; the primary key covers that.
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;

-- RPCs (definer: they read threads/comments.user_id, which no client can select) -----------------------------------
create function public.block_author(p_thread_id uuid default null, p_comment_id uuid default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  author uuid;
begin
  if me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if (p_thread_id is null) = (p_comment_id is null) then
    raise exception 'exactly one of p_thread_id, p_comment_id' using errcode = '22023';
  end if;
  if p_thread_id is not null then
    select t.user_id into author from public.threads t where t.id = p_thread_id;
  else
    select c.user_id into author from public.comments c where c.id = p_comment_id;
  end if;
  if author is null or author = me then return false; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (me, author) on conflict do nothing;
  return true;
end $$;

create function public.my_block_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.user_blocks where blocker_id = auth.uid();
$$;

create function public.unblock_all() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.user_blocks where blocker_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.block_author(uuid, uuid), public.my_block_count(), public.unblock_all()
  from public, anon;
grant execute on function public.block_author(uuid, uuid), public.my_block_count(), public.unblock_all()
  to authenticated;

-- Views: same columns and order as 0013 (threads_feed) and 0011 (comments_feed), plus the block filter. ------------
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
             and not exists (select 1 from public.user_blocks b
                             where b.blocker_id = (select auth.uid()) and b.blocked_id = c.user_id)
             and (c.parent_id is null
                  or exists (select 1 from public.comments pc
                             where pc.id = c.parent_id and pc.status = 'published'
                               and not exists (select 1 from public.user_blocks b
                                               where b.blocker_id = (select auth.uid()) and b.blocked_id = pc.user_id)))) as comment_count,
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
      and not exists (select 1 from public.user_blocks b
                      where b.blocker_id = (select auth.uid()) and b.blocked_id = c.user_id)
    order by c.helpful_count desc, c.created_at desc limit 1
  ) top on true
  where (t.status = 'published' or t.user_id = (select auth.uid()))
    and not exists (select 1 from public.user_blocks b
                    where b.blocker_id = (select auth.uid()) and b.blocked_id = t.user_id);

-- A reply under a blocked author's comment goes too: the app only draws replies under a visible parent (see 0011).
create or replace view public.comments_feed with (security_invoker = false) as
  select c.id, c.thread_id, c.parent_id, c.body, c.anonymous,
         case when c.anonymous then null else p.handle end as handle,
         case when c.anonymous then null else p.avatar_hue end as avatar_hue,
         c.status, c.helpful_count, c.created_at,
         coalesce(c.user_id = (select auth.uid()), false) as mine,
         exists (select 1 from public.comment_votes cv
                 where cv.comment_id = c.id and cv.user_id = (select auth.uid())) as voted
  from public.comments c
  join public.threads t on t.id = c.thread_id
  left join public.comments pc on pc.id = c.parent_id
  left join public.profiles p on p.id = c.user_id
  where (c.user_id = (select auth.uid())
         or (c.status = 'published' and (c.parent_id is null or pc.status = 'published')))
    and (t.status = 'published' or t.user_id = (select auth.uid()))
    and not exists (select 1 from public.user_blocks b
                    where b.blocker_id = (select auth.uid()) and b.blocked_id in (c.user_id, t.user_id, pc.user_id));
