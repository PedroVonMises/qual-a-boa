-- 0011_community_hidden_parents.sql
-- A reply whose parent comment was hidden (moderation or 3 reports) used to stay in comments_feed and in
-- threads_feed.comment_count, but the app only draws replies under a visible parent: the thread showed
-- "3 respostas" over replies nobody could see. Replies now follow their parent: hidden parent, hidden reply
-- (the reply's own author still sees it). Same columns as 0010, so grants and view options carry over.

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
    and (t.status = 'published' or t.user_id = (select auth.uid()));
