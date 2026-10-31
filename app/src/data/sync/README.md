# Remote sync (Wave 5)
Local persisted stores stay the source of truth for the UI (offline-first). When `isRemote()` and `ensureUserId()` resolve,
each store pushes its writes to Supabase (fire-and-forget, failures never block the UI) and `pull*()` merges server rows on launch.
Column mapping: `SupportMessage.from` <-> `support_messages.sender`; favorites venues/artists are stored by slug locally and by uuid
(`favorites.ref_id`) remotely, so map through the catalog at this boundary.

## Comunidade (`community.ts`, store `state/community.ts`)
Threads, comments, "Útil" votes and reports follow the same local-first rule. Reads come from the `threads_feed` / `comments_feed`
views (never the tables). `flushCommunity()` pushes this device's unsynced items oldest first: threads, then comments (parents before
replies), swapping local ids (`th-`, `cm-`) for server uuids and re-pointing children. Posting by name claims the handle first
(`profiles` upsert; a unique clash = "taken"). A rejected item stays on the device and is skipped for the rest of that run; the next
post or feed load retries it. Ids that are not uuids (seed data, demo content) never reach the server. A comment's stored
`helpfulCount` excludes the viewer's own vote, which the UI adds back from `votedIds`; server-confirmed votes are adopted into it.

