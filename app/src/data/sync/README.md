# Remote sync (Wave 5)
Local persisted stores stay the source of truth for the UI (offline-first). When `isRemote()` and `ensureUserId()` resolve,
each store pushes its writes to Supabase (fire-and-forget, failures never block the UI) and `pull*()` merges server rows on launch.
Column mapping: `SupportMessage.from` <-> `support_messages.sender`; favorites venues/artists are stored by slug locally and by uuid
(`favorites.ref_id`) remotely, so map through the catalog at this boundary.

## Comunidade (`community.ts`, store `state/community.ts`)
Threads, comments, "Útil" votes and reports follow the same local-first rule. Reads come from the `threads_feed` / `comments_feed`
views (never the tables): the feed (newest 100), one event's threads (hub) and a single thread by id are separate queries, so old
events and deep links are not cut off by the feed window. A push bumps `tick`; each query refetches in place (the key does not
change, so nothing blanks).
`flushCommunity()` pushes this device's unsynced items oldest first: threads, then comments (parents before replies), swapping local
ids (`th-`, `cm-`) for server uuids and re-pointing children. A synced thread keeps an alias (`aliases[localId]`) so a screen opened on
its local id keeps resolving it. The handle is claimed once per run, and only when a named post is waiting. If it is owned by someone
else (chosen offline), the local handle is dropped and `handleTaken` asks for a new one; anonymous posts still go out and named ones
wait. A rejected item stays on the device and is skipped for the rest of that run; the next post or feed load retries it. Ids that
are not uuids (seed data, demo content) never reach the server. A comment's stored `helpfulCount` excludes the viewer's own vote,
which the UI adds back from `votedIds`; server-confirmed votes are adopted into it. Your own comments cannot be voted (the server
rejects it), so the button is disabled there.
