# Comunidade: event-scoped forum with "Mais útil" highlight

Date: 2026-10-31. Mockups: `docs/design-canvas/Comunidade*.dc.html` (boards C1–C4).

## Problem
Discovery-only app. Users still can't get honest, current answers to three questions: *is it worth going?*, *who's going / group plans*, *what's happening right now*.

## Decisions
- Pain points: `vale_a_pena`, `grupo`, `agora` (thread kinds).
- Identity: `@handle` plus per-post anonymous toggle (same masking as `reviews_feed`).
- Scope: every thread belongs to an event or a venue. No global free-form posts.
- Design system: existing Riot Pink on Night Charcoal tokens; no new tokens.

## Helpful highlight
- Single "Útil" tap per user per comment/thread (no downvotes).
- A comment gets the "Mais útil" badge at >= 3 helpful votes; the top one is pinned in the thread and previewed on the feed card ("Mais útil · N pessoas", pink accent; amber stays reserved for light and stars).
- Sort: Mais úteis (default) / Recentes. `agora` defaults to Recentes and archives when the event ends.
- Ties are broken by recency.

## Screens
| Board | Route | Notes |
|---|---|---|
| C1 | `(tabs)/comunidade` | 5th tab between Mapa and Salvos; segments Para você / Hoje à noite / Seguindo; kind chips |
| C2 | `comunidade/evento/[id]` | per-event hub; tabs by kind; sort; CTA "Perguntar sobre este evento" |
| C3 | `comunidade/t/[id]` | post, pinned Mais útil, nesting depth <= 2, sticky composer |
| C4 | sheet | event, kind, title, details, anonymous toggle |

Handle setup is a sheet shown on first post/comment. Out of scope: public profiles, DMs, media, downvotes.

## Data (migrations 0010-0012, applied to the remote on 2026-10-31)
- `profiles.handle` (unique, `^[a-z0-9_.]{3,20}$`) and `avatar_hue`; shown only through the feed views.
- `threads` (event xor venue, kind, title <= 120, body <= 800), `comments` (body <= 500, depth <= 1 by trigger), `comment_votes` (one per user and comment, count kept by trigger), `community_reports` (one target, one per user and target).
- Votes apply to comments only: the UI has no thread vote, and this keeps real foreign keys.
- `user_id` is never selectable (column grants). `threads_feed` / `comments_feed` hide the handle when `anonymous` and expose `mine`, `voted`, `comment_count`, `archived` (`agora` thread of an ended event) and the pinned reply (`top_comment_*`, >= 3 votes, ties to the newest).
- Content is immutable for clients (insert and delete only). Posting by name needs a handle; anonymous does not.
- Moderation: 3 distinct reporters auto-hide a thread or comment; the author still sees it as hidden. Threshold is a trigger constant.
- Tests: `supabase/tests/community.test.ts`.

## Accessibility and states
44px hit targets, 16px body, AA contrast on dark and light, reduced-motion fade only. Loading = `Skeleton`; empty = `EmptyState` ("Seja o primeiro a perguntar"); error = `ErrorState`.

## Open items
- Confirm the auto-hide threshold (implemented as 3 distinct reports).
- Not yet exercised against the live project: the sync layer is tested against a fake client only.
- No moderation UI for the author of a hidden post. Comments inside a thread are not paged (decided); revisit when a real thread nears ~200.
- "Hoje à noite" skips archived `agora` threads while scanning; fine while recent ended ones are few, add a partial index if it shows in the plans.
- Abuse: users are anonymous auth accounts, so 3 throwaway accounts can auto-hide any post, and thread/comment/report inserts are not throttled. Needs a decision (account age, per-user rate limits, or a higher threshold) before launch.
- The performance advisor lists the foreign keys on `threads.user_id`, `comments.user_id`, `comment_votes.user_id` and `community_reports.thread_id/comment_id` as unindexed (INFO). Harmless while the tables are empty; account deletion and report lookups will scan them at scale, so index them before real traffic.

## Feed sizing and comfort
Page size is **20** for the feed and the event page (`COMMUNITY_PAGE_SIZE`). Not measured (no analytics): a card is ~110-180px, so 20 rows is ~3-4 screens; the next page is requested at 60% of the list so scrolling never stops; same size as Explorar. Change the constant, nothing else.
Comfort rules: nothing is inserted above what the user is looking at (refresh only after their own push, on pull-to-refresh and on mount); a filter change keeps the old list until the new one arrives; first load shows skeletons, a failure shows an error with retry (never "no conversations"); a failed next page keeps the list with an inline retry; the end of the feed says "Você viu tudo por aqui." with a button to start a conversation.
Measured on 8,000 synthetic threads (PGlite): feed page 1-2 ~0.5-1.3 ms (reads ~31 rows), event page ~0.5 ms, helpful sort ~1.6 ms, versus ~100 ms and a full scan before the indexes.

## State scope (UF)
The Comunidade shows conversations of **one state**. The explainer "Conversas de quem está no seu estado." sits under the title and a state pill opens "Seu estado" (all 27 states, only Espírito Santo selectable during the pilot, the others "Em breve"; the choice is stored on the device, `qab.region`). Mockups C1 and C5.
Data (migration 0013): `venues.uf` (default `ES`) and `threads.uf`, set by a server trigger from the event's venue (or the thread's own venue) so a client can never choose it; `threads_feed` exposes `uf` as its last column; index `(uf, created_at desc, id desc)`. The feed queries `uf = <chosen state>`; an event's own page does not filter by state. `Venue.uf` is optional in the app because the static event feed does not carry it; missing means ES. Applied to the remote on 2026-10-31 (the pilot data needed no change: every venue is ES).
