-- 0012_community_feed_paging.sql
-- Indexes for the paged feeds (app/src/data/sync/community.ts, pullThreadsPage). The feed asks for the newest
-- threads with a keyset cursor `(created_at, id) < (X, Y)`, ordered `created_at desc, id desc`, either globally or for
-- one event and kind, through the `threads_feed` view.
--
-- 0010's indexes do not serve that ordering: `threads_created_idx` has no id tiebreak and `threads_event_idx` has
-- `status` between the event and the date. With 8,000 threads the planner read every row and sorted them (~100 ms for
-- page 1); with the indexes below it reads 21 rows in index order (~0.5 ms).
--
-- NOT partial on `status = 'published'`: the view shows `published OR own`, and Postgres cannot prove that implies the
-- partial predicate, so a partial index would never be chosen. Plain indexes are used and the visibility test runs as a
-- cheap filter while scanning (almost every row is published).

create index threads_feed_idx on public.threads (created_at desc, id desc);

create index threads_feed_event_kind_idx on public.threads (event_id, kind, created_at desc, id desc);

-- Redundant now (same leading column, no tiebreak).
drop index public.threads_created_idx;
