# Vibe & access filters: design

Status: approved by Pedro 2026-10-29. First sub-project of "Wave 1, trust".

## Problem
People with access needs, LGBTQIA+ people, and people bringing a dog or avoiding animal products cannot tell from a flyer whether a night will work for them. Today Filtros only covers genre, price, distance, date and artist.

## Scope
Four fixed tags, filterable and shown on Evento and Casa:

| slug | label (pt-BR) |
|---|---|
| `acessivel` | Acessível |
| `lgbtqia` | LGBTQIA+ friendly |
| `pet-friendly` | Pet friendly |
| `vegano` | Opção vegana |

Out of scope: user-submitted tags, tag verification workflow, per-tag detail text (e.g. what "acessível" covers), more tags. A later sub-project (Event page v2) can add the detail.

## Decisions
- **Where tags live:** venues carry tags; an event may add its own (themed nights). The effective tags of an event are the union of both.
- **Matching is AND.** Selecting `acessivel` and `vegano` returns only events with both. OR would show people places that do not meet a stated need.
- **Storage:** `text[]` of slugs with a CHECK against the allowed list, the same pattern as `genre_slugs`. Rejected: a tags table with join tables (overkill for four fixed tags), one boolean column per tag (every new tag needs a migration and a new search parameter).
- **Honesty:** tags on the demo venues are demonstration data like the rest of the seed. Nothing is presented as verified (see the README legal note and `docs/VENUES.md`).

## Data: migration `supabase/migrations/0009_access_tags.sql`
- `venues.access_tags text[] not null default '{}'` and `events.access_tags text[] not null default '{}'`, each with a CHECK that every element is in the allowed list.
- `search_events` gains `p_tags text[] default null`; when set, rows are kept where `(venue.access_tags || event.access_tags) @> p_tags`.
- The function also returns `access_tags text[]` (the effective, de-duplicated set). Return columns change, so the function is dropped and recreated and its grants re-applied.
- `supabase/README.md` documents the new parameter and column.

## Domain and repos (`app/src`)
- `domain/types.ts`: `AccessTag` union, `ACCESS_TAGS` list with labels; `Venue.accessTags?`, `EventItem.accessTags?` (own tags; the RPC returns the effective set) and `effectiveTags()`, `SearchParams.tags?`.
- `domain/filters.ts`: `FilterState.tags: string[]` (default `[]`); included in `toSearchParams`, `countActiveFilters`, `filtersToUrlParams` (`tags=acessivel,vegano`) and `urlParamsToFilters` (unknown slugs dropped).
- `data/seedRepo.ts`, `data/feedRepo.ts`, `data/supabaseRepo.ts` apply the same AND match over effective tags; `data/parity.test.ts` proves they agree.
- `supabase/seed/seed-data.ts` assigns demo tags to venues and one event; the ingest feed already passes optional fields through and the app's `validateFeed` drops unknown slugs, so `ingest/` is unchanged.

## UI
- `features/filtros/Sections.tsx`: new section "Vibe & acesso", multi-select chips in the existing chip style (40px, Riot Pink when active). No emojis as icons (DESIGN.md section 9).
- Active-filter count and the "Ver N eventos" footer work unchanged through `countActiveFilters`.
- `features/evento` and `features/casa`: small text badges for the tags, text only (color is never the sole signal).
- `features/explorar/EmptyResults.tsx`: when tags are active and nothing matches, the suggestion offers removing a tag.
- `docs/DESIGN.md`: one line describing the section and badges.

## Error handling
- Unknown slug in a URL, feed or stored filter: ignored, never throws.
- Offline or feed-only mode: filtering runs client-side in `feedRepo` with identical semantics.

## Testing
- `domain/domain.test.ts`: URL round-trip, unknown slugs, `countActiveFilters`, `toSearchParams`.
- Repo tests and `parity.test.ts`: AND logic and venue+event union across seed, feed and Supabase repos.
- SQL (PGlite) tests: CHECK rejects an unknown slug; RPC filters by `p_tags`; effective set is the union.
- `features/filtros/__tests__/filtros.test.tsx`: toggling tags updates the count and the URL.
- CI gate unchanged: typecheck, lint, jest, test:sql, web export.

## Rollout
One PR on `feat/vibe-access-filters`. Apply the migration to the remote Supabase project before shipping the new app build. `supabaseRepo` omits `p_tags` when no tag is selected, so unfiltered searches never depend on the migration; selecting a tag against an un-migrated database fails, which is why the migration goes first. Already-installed older builds ignore the extra `access_tags` return column.
