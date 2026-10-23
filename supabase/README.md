# supabase/

Backend for "Qual a boa?": Postgres 17 schema, search RPC, RLS, demo seed and SQL tests.
There is **no remote project yet**; everything is validated locally with PGlite (Postgres WASM).

```
migrations/0001_schema.sql         tables, enums, indexes
migrations/0002_search_events.sql  haversine_km, fold_text, search_events(...)
migrations/0003_rls.sql            RLS policies + grants
migrations/0004_views.sql          venue_past_artists, artist_played_at ("já passaram por aqui")
seed/seed-data.ts                  buildSeed(now): SeedDataset (all placeholder demo data)
seed/sql.ts                        SeedDataset -> INSERT statements
seed/build.ts                      writes seed/seed.sql and app/src/data/seed.json (+ fixtures)
seed/seed.sql                      generated
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
p_date_to, p_artist_id, p_area, p_query, p_sort = 'date', p_limit = 20, p_offset = 0, p_now = now())`.
`SearchParams.cursor` maps to `p_offset` (`Number(cursor)`), `now` to `p_now`.
Returns event columns plus `genre_slugs` (taxonomy order), `artist_ids` (billing order),
`venue_*` columns (full venue), `distance_km` and `total_count`.

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
10. `total_count` = matches before pagination. A page past the end returns no rows (so no total);
    the test harness then re-queries with offset 0 to get it.

## Attaching a remote Supabase project later (instructions only, not yet done)

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
