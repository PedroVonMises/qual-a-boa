# Remote sync (Wave 5)
Local persisted stores stay the source of truth for the UI (offline-first). When `isRemote()` and `ensureUserId()` resolve,
each store pushes its writes to Supabase (fire-and-forget, failures never block the UI) and `pull*()` merges server rows on launch.
Column mapping: `SupportMessage.from` <-> `support_messages.sender`; favorites venues/artists are stored by slug locally and by uuid
(`favorites.ref_id`) remotely, so map through the catalog at this boundary.
