# Remote sync (Wave 5)
Local persisted stores stay the source of truth for the UI (offline-first). When `isRemote()` and `ensureUserId()` resolve,
each store pushes its writes to Supabase (fire-and-forget, failures never block the UI) and `pull*()` merges server rows on launch.
Column mapping: `SupportMessage.from` <-> `support_messages.sender`; favorites venues/artists are stored by slug locally and by uuid
(`favorites.ref_id`) remotely, so map through the catalog at this boundary.

## Comunidade (`community.ts`, store `state/community.ts`)
Threads, comments, "Útil" votes and reports follow the same local-first rule. Reads come from the `threads_feed` / `comments_feed`
views (never the tables).

**Feeds are paged** (`COMMUNITY_PAGE_SIZE` = 20, `domain/community.ts`). `pullThreadsPage(query, cursor)` asks for 21 rows (the extra
row says "there is a next page" without a count query) and returns 20 plus `nextCursor`. Recency pages by a keyset cursor
`created_at|id`, so a thread posted while someone scrolls cannot duplicate or skip a row; the helpful sort (event page) pages by
offset and the client dedupes by id. Filters (`kind`, "Hoje à noite", "Seguindo", archived) run on the server so every page is full.
`useThreadsInfinite` keeps the previous list while a filter changes. A push (`tick`) re-reads **page 1 only**
(`refreshFirstPage`): if its boundary did not move the later pages stay, otherwise the list falls back to page 1 (a kept page 2
would leave a gap). Pull-to-refresh always goes back to page 1. In seed mode `useThreads` pages client-side with the same shape.
A thread by id (`pullThread`) and a thread's comments are separate queries, so a deep link never loads a feed page.
Migration 0012 holds the indexes that make these queries stop after ~21 rows (plain, not partial: the view's `published OR own`
test would stop a partial index being chosen).

**Pushing.** `flushCommunity()` pushes this device's unsynced items oldest first: threads, then comments (parents before
replies), swapping local ids (`th-`, `cm-`) for server uuids and re-pointing children. A synced thread keeps an alias
(`aliases[localId]`) so a screen opened on its local id keeps resolving it. The handle is claimed once per run, and only when a named
post is waiting. If it is owned by someone else (chosen offline), the local handle is dropped and `handleTaken` asks for a new one;
anonymous posts still go out and named ones wait. A rejected item stays on the device and is skipped for the rest of that run;
the next post or feed load retries it. Ids that are not uuids (seed data, demo content) never reach the server. A comment's stored
`helpfulCount` excludes the viewer's own vote, which the UI adds back from `votedIds`; server-confirmed votes are adopted into it.
Your own comments cannot be voted (the server rejects it), so the button is disabled there.

Dev only: `EXPO_PUBLIC_DEMO_THREADS=60` adds synthetic threads in seed mode (ids are not uuids) to try the paging by hand.
