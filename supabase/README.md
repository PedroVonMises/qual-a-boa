# supabase/

Backend for "Qual a boa?": Postgres 17 schema, search RPC, RLS, demo seed and SQL tests.
There is **no remote project yet**; everything is validated locally with PGlite (Postgres WASM).

```
migrations/0001_schema.sql         tables, enums, indexes
migrations/0002_search_events.sql  haversine_km, fold_text, search_events(...)
migrations/0003_rls.sql            RLS policies + grants
migrations/0004_views.sql          venue_past_artists, artist_played_at ("já passaram por aqui")
seed/seed-data.ts                  buildSeed(now): SeedDataset (all demonstration data; Casa Maré demo events are identified by their `casa-mare-demo-*` ticket URL, not by title)
seed/sql.ts                        SeedDataset -> INSERT statements
seed/build.ts                      writes seed/seed.sql and app/src/data/seed.json (+ fixtures)
seed/seed.sql                      generated
migrations/0005_engage.sql         event_follows, checkins, event_reports, reviews(+feed view), review_votes, review_reports,
                                   support_tickets/messages, event_live_summary(event_id); owner-only RLS.
                                   Check-in: published event, from starts_at-2h to ends_at (or start+8h), unique per user/event.
                                   Reports: need a check-in <6h, throttled 1 per user/event/10 min, price 0..1000, user_id not
                                   selectable (column grants). Reviews: user_id hidden, topics/tags/text(800) validated, content
                                   edits reset status to 'pending' (not service_role), event must be published and started
                                   (or attended). Votes/review_reports: published reviews, not your own (can_vote_review, definer).
                                   Tickets: user message reopens; no user DELETE. event_live_summary mirrors aoVivo/logic.ts
                                   (2h window, mode with recency tie-break, median price). Trigger-only definer functions are
                                   revoked from public/anon/authenticated. SupportMessage.from is column `sender`
0003_rls.sql note                  events (and their join rows) are readable when published OR cancelled; search_events and the
                                   history functions still filter published. https-only ticket_url / photo_url checks live in 0001
migrations/0006_catalog_ingest.sql events.source/source_id/source_url/fetched_at/image_url (https checks, unique (source, source_id)
                                   where both set); venue_aliases(venue_id, alias unique; read-only for anon/authenticated via RLS,
                                   writes service_role only); cover_key CHECK relaxed to ^[a-z0-9:_-]{1,48}$ on venues and events;
                                   search_events returns image_url after cover_key (function dropped, recreated, grants re-applied).
                                   Tests: tests/catalog_ingest.test.ts. Used by ingest/ and the static feed (docs/INGESTION.md)
migrations/0008_search_artists.sql  search_artists(p_query, p_limit): accent-insensitive artist search via fold_text; pins
                                   search_path on haversine_km, fold_text, valid_review_topics/tags. Tests: tests/search.test.ts
tests/harness.ts                   PGlite + stub auth schema + roles anon/authenticated/service_role
tests/reference.ts                 TS reading of the search spec used to cross-check the SQL
tests/fixtures/seed-fixed.json     dataset with now = 2026-10-23T12:00:00Z
tests/fixtures/search-cases.json   {name, params, expectedEventIds, expectedTotal}[] computed by the SQL
tests/*.test.ts                    node:test suites
```

## Commands (run in `app/`)

```sh
npm run seed                 # seed.sql + app/src/data/seed.json, dates relative to now
npm run seed -- --fixtures   # also regenerates tests/fixtures (SQL is the oracle)
npm run test:sql             # all SQL tests (PGlite, offline)
```

`seed.sql` and `seed.json` contain dates relative to the moment they were generated. Re-run
`npm run seed` to refresh "upcoming" events. Fixtures use a fixed `now` and are stable.
IDs are deterministic UUIDs: `md5("<kind>:<slug>")` in UUID v3 layout
(kind = genre | venue | artist | event; event slug = `<venue>-<title>-w<n>` or `-p<n>`).

## search_events contract (mirror this in SeedRepo)

Signature: `search_events(p_lat, p_lng, p_radius_km, p_genre_slugs, p_price_max, p_date_from,
p_date_to, p_artist_id, p_area, p_query, p_sort = 'date', p_limit = 20, p_offset = 0, p_now = now(), p_tags = null)`
(`p_tags text[]` added in migration `0009_access_tags.sql`).
`SearchParams.cursor` maps to `p_offset` (`Number(cursor)`), `now` to `p_now`.
Returns event columns plus `genre_slugs` (taxonomy order), `artist_ids` (billing order),
`venue_*` columns (full venue), `access_tags` (effective set: venue tags plus event tags), `distance_km` and `total_count`.

1. `status = 'published'`, `starts_at >= coalesce(p_date_from, p_now)` (a past `dateFrom` *does* return
   past events), venue `status <> 'closed'` (unverified venues are included).
2. Distance: `2*6371*asin(min(1, sqrt(sin²(Δlat/2) + cos lat1 cos lat2 sin²(Δlng/2))))` in radians.
   Radius check uses the unrounded distance, inclusive. `distance_km` = round(distance, 3).
3. Genres: OR overlap. `null` or `[]` = no filter.
4. Price: `null` = no filter; `0` = only `is_free`; `> 0` = `is_free OR (price_min is not null AND price_min <= max)`.
5. `p_date_to` inclusive.
6. Artist: lineup contains id.
7. Area: `lower(area) = lower(p_area)`, exact (not substring); `null` / `''` = no filter.
8. Query: trimmed; `''` = no filter. Fold = lower-case + strip accents
   (`normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()`); plain substring
   (no wildcards) over event title, venue name, any lineup artist name.
9. Sort: `distance` asc on the **rounded** `distance_km`; `price` asc on `is_free ? 0 : price_min`, nulls last;
   `date`; `popularity` desc. Unknown sort = `date`. Always tie-break `starts_at` asc, then `id` asc
   (lower-case UUID string order = Postgres uuid order).
10. Tags (`p_tags text[]`): AND. Every requested tag must be in `venues.access_tags || events.access_tags`. `null` or `[]` = no filter.
    `supabaseRepo` omits `p_tags` when no tag is selected, so unfiltered searches work before 0009 is applied.
11. `total_count` = matches before pagination. A page past the end returns no rows (so no total);
    the test harness then re-queries with offset 0 to get it.

## Remote Supabase project

Project `qualaboa` (ref `kcwtbmznclayplexoxhc`, us-west-2, Postgres 17) has migrations 0001–0012 applied: 0001–0008 on 2026-10-29 (0008 is recorded as `search_artists`), and 0009–0012 on 2026-10-31. `0011_community_hidden_parents.sql` makes replies follow a hidden parent in `comments_feed` and `comment_count`; `0012_community_feed_paging.sql` adds the feed paging indexes and drops `threads_created_idx`.
On 2026-10-31 the catalog had rows (10 genres, 8 venues, 25 artists, 76 events); all user and community tables were empty. The events and venues were loaded before 0009, so their `access_tags` are empty until the seed or ingest is re-run. Anonymous sign-ins must be enabled in Authentication > Sign In / Providers.
The security advisor lists `reviews_feed`, `threads_feed` and `comments_feed` (definer views) and `can_vote_review`, `owns_review`, `can_vote_comment`, `can_report_thread` (definer functions callable by signed-in users). This is intentional: the views hide `user_id` on anonymous posts and the RLS policies call the functions as the caller.
The generic steps below apply to attaching any other project.

Prereqs: Supabase CLI installed and logged in (`supabase login`), a project created in the dashboard.

1. From the repo root, initialise config once if `supabase/config.toml` does not exist:
   `supabase init` (keep the existing `migrations/` folder).
2. Link: `supabase link --project-ref <project-ref>` (asks for the database password).
3. Review what will run: `supabase db push --dry-run`.
4. Apply migrations: `supabase db push`.
5. Load demo data (placeholder content, optional; it truncates catalog tables first):
   regenerate with `npm run seed` in `app/`, then run `supabase/seed/seed.sql`
   with `psql "$(supabase db url)" -f supabase/seed/seed.sql` or paste it into the SQL editor.
   For `supabase db reset` on a local stack, point `[db.seed] sql_paths = ["./seed/seed.sql"]` in config.toml.
6. App: set `EXPO_PUBLIC_DATA_SOURCE=supabase`, `EXPO_PUBLIC_SUPABASE_URL` and the publishable (anon) key
   in `app/.env` (never commit keys; never ship the service_role key in the app).
7. Check the security/performance advisors in the dashboard after the first push.

Notes: migrations assume Supabase's `auth.users` / `auth.uid()` and the roles `anon`, `authenticated`,
`service_role` (all present on Supabase). The tests create stubs of them.
