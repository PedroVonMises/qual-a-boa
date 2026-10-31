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

## Data (migration 0010, written and tested locally; not applied to the remote)
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
- No moderation UI for the author of a hidden post, and no pagination beyond the newest 100 threads in the global feed (an event's hub and a single thread are fetched on their own).
- Abuse: users are anonymous auth accounts, so 3 throwaway accounts can auto-hide any post, and thread/comment/report inserts are not throttled. Needs a decision (account age, per-user rate limits, or a higher threshold) before launch.
- `0011_community_hidden_parents.sql` is not applied to the remote yet.
- 0009 is not applied to the remote; confirm ordering before applying 0010.
