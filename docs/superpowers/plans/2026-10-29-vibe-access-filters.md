# Vibe & access filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people filter events by four tags (Acessível, LGBTQIA+ friendly, Pet friendly, Opção vegana) and see those tags on Evento and Casa.

**Architecture:** Venues and events carry `access_tags text[]` (fixed slug list, CHECK constrained). An event's effective tags are the union of its venue's and its own. `search_events` gets `p_tags` (AND match on effective tags) and returns the effective set; the three repos (seed, feed, Supabase) apply the same rule and a shared fixture proves parity.

**Tech Stack:** Expo/React Native + TypeScript, zustand, jest + @testing-library/react-native, Postgres (PGlite in tests), `node --test` for SQL.

Spec: `docs/superpowers/specs/2026-10-29-vibe-access-filters-design.md`. Work on branch `feat/vibe-access-filters`. All commands run from `C:\Users\HP\qual-a-boa\app` unless stated. Commit trailer on every commit: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

Notes that differ slightly from the spec text (decided while reading the code):
- `accessTags` is **optional** (`accessTags?: AccessTag[]`) on `Venue` and `EventItem`, so feed JSON, `mini.ts` and old fixtures stay valid. `EventItem.accessTags` holds the event's own tags in seed/feed data and the effective set when it comes from the RPC; `effectiveTags(event, venue)` is idempotent, so the UI always uses it.
- `search_events` was last redefined in `0006_catalog_ingest.sql` (it has `image_url`), so `0009` recreates that version.
- The ingest feed already passes unknown optional fields through; unknown slugs are dropped by the app's `validateFeed`. No `ingest/` code changes.

---

## File structure

| File | Responsibility |
|---|---|
| `app/src/domain/accessTags.ts` (new) | Tag slugs, labels, `isAccessTag`, `cleanTags`, `effectiveTags`, `matchesTags` |
| `app/src/domain/accessTags.test.ts` (new) | Unit tests for the above |
| `app/src/domain/types.ts` | `accessTags?` on `Venue`/`EventItem`, `tags?` on `SearchParams` |
| `app/src/domain/filters.ts` | `FilterState.tags`, params, count, URL codec |
| `app/src/state/filters.ts` | `toggleTag`, tag-safe `replace` |
| `supabase/migrations/0009_access_tags.sql` (new) | Columns, CHECKs, `search_events` v3 |
| `supabase/tests/harness.ts`, `reference.ts`, `search.test.ts`, `schema-seed.test.ts` | SQL oracle + tests |
| `supabase/seed/seed-data.ts`, `sql.ts`, `build.ts` | Demo tags, SQL inserts, fixture cases |
| `app/src/data/seedRepo.ts`, `feedRepo.ts`, `supabaseRepo.ts` | Same AND match in all repos |
| `app/src/data/__fixtures__/mini.ts` | Tags on mini venues for UI tests |
| `app/src/features/filtros/Sections.tsx` | "Vibe & acesso" chips |
| `app/src/features/evento/AccessBadges.tsx` (new), `EventoScreen.tsx`, `features/casa/CasaScreen.tsx` | Badges |
| `app/src/features/explorar/EmptyResults.tsx` | Tag-aware empty state |
| `supabase/README.md`, `docs/DESIGN.md`, `README.md` | Docs |

---

### Task 1: Tag domain module

**Files:**
- Create: `app/src/domain/accessTags.ts`
- Create: `app/src/domain/accessTags.test.ts`
- Modify: `app/src/domain/types.ts` (Venue, EventItem, SearchParams)

- [ ] **Step 1: Write the failing test**

Create `app/src/domain/accessTags.test.ts`:

```ts
import { ACCESS_TAGS, cleanTags, effectiveTags, isAccessTag, matchesTags, tagLabel } from './accessTags';

describe('accessTags', () => {
  it('has the four tags with pt-BR labels', () => {
    expect(ACCESS_TAGS.map((t) => t.slug)).toEqual(['acessivel', 'lgbtqia', 'pet-friendly', 'vegano']);
    expect(tagLabel('acessivel')).toBe('Acessível');
    expect(tagLabel('lgbtqia')).toBe('LGBTQIA+ friendly');
    expect(tagLabel('pet-friendly')).toBe('Pet friendly');
    expect(tagLabel('vegano')).toBe('Opção vegana');
  });

  it('isAccessTag and cleanTags drop unknown or duplicate values', () => {
    expect(isAccessTag('vegano')).toBe(true);
    expect(isAccessTag('nope')).toBe(false);
    expect(cleanTags(['vegano', 'nope', 'vegano', 'acessivel'])).toEqual(['acessivel', 'vegano']);
    expect(cleanTags(undefined)).toEqual([]);
    expect(cleanTags('vegano')).toEqual([]);
  });

  it('effectiveTags is the ordered union of venue and event tags', () => {
    expect(effectiveTags({ accessTags: ['pet-friendly'] }, { accessTags: ['acessivel'] })).toEqual(['acessivel', 'pet-friendly']);
    expect(effectiveTags({}, {})).toEqual([]);
    expect(effectiveTags({ accessTags: ['vegano'] }, { accessTags: ['vegano'] })).toEqual(['vegano']);
  });

  it('matchesTags requires every wanted tag (AND)', () => {
    expect(matchesTags(['acessivel', 'vegano'], ['acessivel'])).toBe(true);
    expect(matchesTags(['acessivel', 'vegano'], ['acessivel', 'vegano'])).toBe(true);
    expect(matchesTags(['acessivel'], ['acessivel', 'vegano'])).toBe(false);
    expect(matchesTags([], [])).toBe(true);
    expect(matchesTags([], undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/domain/accessTags.test.ts`
Expected: FAIL, "Cannot find module './accessTags'".

- [ ] **Step 3: Write the implementation**

Create `app/src/domain/accessTags.ts`:

```ts
// Vibe & access tags. Slugs are stored in Postgres (CHECK in migration 0009) and in the feed; labels live here.

export const ACCESS_TAGS = [
  { slug: 'acessivel', label: 'Acessível' },
  { slug: 'lgbtqia', label: 'LGBTQIA+ friendly' },
  { slug: 'pet-friendly', label: 'Pet friendly' },
  { slug: 'vegano', label: 'Opção vegana' },
] as const;

export type AccessTag = (typeof ACCESS_TAGS)[number]['slug'];

const ORDER = new Map<string, number>(ACCESS_TAGS.map((t, i) => [t.slug, i]));

export const isAccessTag = (v: unknown): v is AccessTag => typeof v === 'string' && ORDER.has(v);

export function tagLabel(slug: AccessTag): string {
  return ACCESS_TAGS.find((t) => t.slug === slug)!.label;
}

/** Known slugs only, de-duplicated, in catalog order. Anything that is not an array of strings becomes []. */
export function cleanTags(v: unknown): AccessTag[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter(isAccessTag))].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

type Tagged = { accessTags?: readonly string[] };

/** An event's tags are its venue's plus its own. */
export function effectiveTags(venue: Tagged, event: Tagged): AccessTag[] {
  return cleanTags([...(venue.accessTags ?? []), ...(event.accessTags ?? [])]);
}

/** AND match: `have` must contain every tag in `wanted`. */
export function matchesTags(have: readonly string[], wanted: readonly string[] | undefined): boolean {
  if (!wanted || wanted.length === 0) return true;
  return wanted.every((t) => have.includes(t));
}
```

In `app/src/domain/types.ts` add the import at the top (after the header comments) and the fields:

```ts
import type { AccessTag } from './accessTags';
```

In `interface Venue`, after `genreSlugs: string[];` add:

```ts
  /** Vibe & access tags the venue declares (demonstration data until verified). */
  accessTags?: AccessTag[];
```

In `interface EventItem`, after `genreSlugs: string[];` add:

```ts
  /** Extra tags for this night (themed events). Rows from search_events carry the effective set. */
  accessTags?: AccessTag[];
```

In `interface SearchParams`, after `genreSlugs?: string[];` add:

```ts
  tags?: string[]; // every tag must match (AND) against the venue's plus the event's tags
```

- [ ] **Step 4: Run test and typecheck**

Run: `npx jest src/domain/accessTags.test.ts && npm run typecheck`
Expected: 4 tests PASS; typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/src/domain/accessTags.ts app/src/domain/accessTags.test.ts app/src/domain/types.ts
git commit -m "feat(tags): access tag domain module and types" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Filter state, URL codec and store

**Files:**
- Modify: `app/src/domain/filters.ts`
- Modify: `app/src/state/filters.ts`
- Test: `app/src/domain/domain.test.ts`

- [ ] **Step 1: Write the failing tests**

In `app/src/domain/domain.test.ts`, add inside the existing `describe` that contains `countActiveFilters` (after the `'URL codec round-trips…'` test):

```ts
  it('tags: count, search params and URL codec', () => {
    const f = { ...defaultFilters, tags: ['acessivel', 'vegano'] };
    expect(countActiveFilters(f)).toBe(1);
    expect(toSearchParams(f, { lat: 1, lng: 2 }, NOW).tags).toEqual(['acessivel', 'vegano']);
    expect(toSearchParams(defaultFilters, { lat: 1, lng: 2 }, NOW).tags).toBeUndefined();
    expect(filtersToUrlParams(f)).toEqual({ tags: 'acessivel,vegano' });
    expect(urlParamsToFilters({ tags: 'acessivel,vegano' }).tags).toEqual(['acessivel', 'vegano']);
    expect(urlParamsToFilters({ tags: 'vegano,nope,vegano' }).tags).toEqual(['vegano']);
    expect(urlParamsToFilters({ tags: ['pet-friendly'] }).tags).toEqual(['pet-friendly']);
    expect(urlParamsToFilters({}).tags).toEqual([]);
  });
```

If `NOW` is not defined in that scope the file already defines it above (it is used by the neighbouring `toSearchParams` test); reuse it.

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/domain/domain.test.ts -t "tags"`
Expected: FAIL (`tags` undefined / type errors).

- [ ] **Step 3: Implement**

In `app/src/domain/filters.ts`:

1. Add import: `import { cleanTags, type AccessTag } from './accessTags';`
2. In `interface FilterState`, after `genreSlugs: string[];` add `tags: AccessTag[];`
3. In `defaultFilters`, after `genreSlugs: [],` add `tags: [],`
4. In `toSearchParams`, after the `genreSlugs` line add: `if (filters.tags.length) params.tags = filters.tags;`
5. In `countActiveFilters`, after the genre line add: `if (f.tags.length) n++;`
6. In `filtersToUrlParams`, after the genres line add: `if (f.tags.length) out.tags = f.tags.join(',');`
7. In `urlParamsToFilters`, change the first line to `const f: FilterState = { ...defaultFilters, genreSlugs: [], tags: [] };` and after the genres block add:

```ts
  const tags = first(raw.tags);
  if (tags) f.tags = cleanTags(tags.split(',').map((s) => s.trim()));
```

In `app/src/state/filters.ts`:

1. Add `import type { AccessTag } from '@/domain/accessTags';`
2. In `interface FiltersStore` add `toggleTag: (slug: AccessTag) => void;`
3. Replace the initial `filters:`, `replace` and `reset` bodies so every place that copies `genreSlugs` also copies `tags`, and add `toggleTag`:

```ts
export const useFilters = create<FiltersStore>((set) => ({
  filters: { ...defaultFilters, genreSlugs: [], tags: [] },
  set: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  toggleGenre: (slug) =>
    set((s) => {
      const has = s.filters.genreSlugs.includes(slug);
      const genreSlugs = has ? s.filters.genreSlugs.filter((g) => g !== slug) : [...s.filters.genreSlugs, slug];
      return { filters: { ...s.filters, genreSlugs } };
    }),
  toggleTag: (slug) =>
    set((s) => {
      const has = s.filters.tags.includes(slug);
      const tags = has ? s.filters.tags.filter((t) => t !== slug) : [...s.filters.tags, slug];
      return { filters: { ...s.filters, tags } };
    }),
  replace: (f) => set({ filters: { ...f, genreSlugs: [...f.genreSlugs], tags: [...f.tags] } }),
  reset: () => set({ filters: { ...defaultFilters, genreSlugs: [], tags: [] } }),
}));
```

Other code constructs `FilterState` literals (tests, fixtures). Find them with `npm run typecheck` and add `tags: []` where it complains; spreading `defaultFilters` needs no change.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx jest src/domain src/state && npm run typecheck`
Expected: all PASS; typecheck exit 0 (fix any literal `FilterState` it flags by adding `tags: []`).

- [ ] **Step 5: Commit**

```bash
git add app/src/domain app/src/state
git commit -m "feat(tags): tags in filter state, count, search params and URL codec" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Migration 0009 (columns, CHECKs, search_events v3)

**Files:**
- Create: `supabase/migrations/0009_access_tags.sql`
- Modify: `supabase/tests/harness.ts` (`searchArgs`, `SEARCH_SQL`, `SearchRow`)
- Modify: `supabase/seed/sql.ts` (insert the new columns)
- Test: `supabase/tests/access-tags.test.ts` (new)

- [ ] **Step 1: Write the failing SQL test**

Create `supabase/tests/access-tags.test.ts`:

```ts
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { DEFAULT_LOCATION } from '../../app/src/domain/types';
import type { SearchParams, SeedDataset } from '../../app/src/domain/types';
import { createDb, FIXED_NOW, search, type DB } from './harness';

const base: SearchParams = {
  lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng, radiusKm: 30, sort: 'date', limit: 100, now: FIXED_NOW,
};

const ds: SeedDataset = {
  generatedAt: FIXED_NOW,
  genres: [{ id: '00000000-0000-4000-8000-0000000000a1', slug: 'funk', label: 'Funk' }],
  venues: [
    { id: '00000000-0000-4000-8000-0000000000b1', slug: 'v-a', name: 'A', area: 'Centro', city: 'Vitória', lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng,
      status: 'open', adultOnly: true, genreSlugs: ['funk'], coverKey: 'generic', placeholder: true, accessTags: ['acessivel'] },
    { id: '00000000-0000-4000-8000-0000000000b2', slug: 'v-b', name: 'B', area: 'Centro', city: 'Vitória', lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng,
      status: 'open', adultOnly: true, genreSlugs: ['funk'], coverKey: 'generic', placeholder: true },
  ],
  artists: [],
  events: [
    { id: '00000000-0000-4000-8000-0000000000c1', title: 'Só venue acessível', venueId: '00000000-0000-4000-8000-0000000000b1', startsAt: '2026-10-24T02:00:00.000Z',
      priceMin: 10, priceMax: 10, isFree: false, ageMin: 18, genreSlugs: ['funk'], artistIds: [], status: 'published', coverKey: 'generic', popularity: 10 },
    { id: '00000000-0000-4000-8000-0000000000c2', title: 'Venue acessível + evento vegano', venueId: '00000000-0000-4000-8000-0000000000b1', startsAt: '2026-10-24T03:00:00.000Z',
      priceMin: 10, priceMax: 10, isFree: false, ageMin: 18, genreSlugs: ['funk'], artistIds: [], status: 'published', coverKey: 'generic', popularity: 10, accessTags: ['vegano'] },
    { id: '00000000-0000-4000-8000-0000000000c3', title: 'Noite pet no venue sem tags', venueId: '00000000-0000-4000-8000-0000000000b2', startsAt: '2026-10-24T04:00:00.000Z',
      priceMin: 10, priceMax: 10, isFree: false, ageMin: 18, genreSlugs: ['funk'], artistIds: [], status: 'published', coverKey: 'generic', popularity: 10, accessTags: ['pet-friendly'] },
  ],
};
const [c1, c2, c3] = ds.events.map((e) => e.id);

let db: DB;
before(async () => { db = await createDb(ds); });
after(async () => { await db.close(); });

describe('access tags', () => {
  test('no tags param returns everything', async () => {
    const r = await search(db, base);
    assert.deepEqual(r.ids, [c1, c2, c3]);
  });

  test('venue tags apply to the venue\'s events', async () => {
    const r = await search(db, { ...base, tags: ['acessivel'] });
    assert.deepEqual(r.ids, [c1, c2]);
  });

  test('event tags apply to that event only', async () => {
    const r = await search(db, { ...base, tags: ['pet-friendly'] });
    assert.deepEqual(r.ids, [c3]);
  });

  test('multiple tags are ANDed over the union of venue and event tags', async () => {
    const r = await search(db, { ...base, tags: ['acessivel', 'vegano'] });
    assert.deepEqual(r.ids, [c2]);
    const none = await search(db, { ...base, tags: ['acessivel', 'pet-friendly'] });
    assert.deepEqual(none.ids, []);
  });

  test('empty tags array means no filter', async () => {
    const r = await search(db, { ...base, tags: [] });
    assert.equal(r.total, 3);
  });

  test('rows return the effective, ordered, de-duplicated tag set', async () => {
    const r = await search(db, base);
    const by = Object.fromEntries(r.rows.map((x) => [x.id, x.access_tags]));
    assert.deepEqual(by[c1], ['acessivel']);
    assert.deepEqual(by[c2], ['acessivel', 'vegano']);
    assert.deepEqual(by[c3], ['pet-friendly']);
  });

  test('CHECK rejects unknown slugs on venues and events', async () => {
    await assert.rejects(db.query(`update public.venues set access_tags = array['nope'] where slug = 'v-a'`), /access_tags/);
    await assert.rejects(db.query(`update public.events set access_tags = array['nope'] where title = 'Só venue acessível'`), /access_tags/);
  });
});
```

- [ ] **Step 2: Update the harness**

In `supabase/tests/harness.ts`:

1. In `SearchRow` add `access_tags: string[];` (after `genre_slugs`).
2. In `searchArgs`, add after the `p.now ?? …` element a new last element:

```ts
    p.tags ?? null,
```

3. Replace `SEARCH_SQL` with:

```ts
export const SEARCH_SQL = `select * from public.search_events(
  p_lat => $1, p_lng => $2, p_radius_km => $3, p_genre_slugs => $4::text[],
  p_price_max => $5::numeric, p_date_from => $6::timestamptz, p_date_to => $7::timestamptz,
  p_artist_id => $8::uuid, p_area => $9, p_query => $10, p_sort => $11,
  p_limit => $12, p_offset => $13, p_now => $14::timestamptz, p_tags => $15::text[])`;
```

In `supabase/seed/sql.ts`, change the venues insert to include the column. Replace the two lines that build the venues insert with:

```ts
  out.push('insert into public.venues (id, slug, name, area, city, address, lat, lng, status, adult_only, genre_slugs, hours, cover_key, placeholder, access_tags) values');
  out.push(
    ds.venues
      .map((v) =>
        `  (${q(v.id)}, ${q(v.slug)}, ${q(v.name)}, ${q(v.area)}, ${q(v.city)}, ${q(v.address)}, ${n(v.lat)}, ${n(v.lng)}, ${q(v.status)}, ${b(v.adultOnly)}, ${arr(v.genreSlugs)}, ${q(v.hours)}, ${q(v.coverKey)}, ${b(v.placeholder)}, ${arr(v.accessTags ?? [])})`)
      .join(',\n') + ';',
  );
```

and the events insert with:

```ts
  out.push('insert into public.events (id, venue_id, title, starts_at, ends_at, price_min, price_max, is_free, ticket_url, age_min, status, cover_key, popularity, access_tags) values');
  out.push(
    ds.events
      .map((e) =>
        `  (${q(e.id)}, ${q(e.venueId)}, ${q(e.title)}, ${q(e.startsAt)}, ${q(e.endsAt)}, ${n(e.priceMin)}, ${n(e.priceMax)}, ${b(e.isFree)}, ${q(e.ticketUrl)}, ${n(e.ageMin)}, ${q(e.status)}, ${q(e.coverKey)}, ${n(e.popularity)}, ${arr(e.accessTags ?? [])})`)
      .join(',\n') + ';',
  );
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test:sql`
Expected: FAIL (`column "access_tags" of relation "venues" does not exist` or migration-related errors).

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/0009_access_tags.sql`:

```sql
-- 0009: vibe & access tags (acessivel, lgbtqia, pet-friendly, vegano) on venues and events,
-- and a p_tags filter in search_events. An event's effective tags are its venue's plus its own;
-- p_tags matches with AND (every requested tag must be present). Return type changes, so drop and recreate.

alter table public.venues
  add column access_tags text[] not null default '{}',
  add constraint venues_access_tags_known
    check (access_tags <@ array['acessivel', 'lgbtqia', 'pet-friendly', 'vegano']::text[]);

alter table public.events
  add column access_tags text[] not null default '{}',
  add constraint events_access_tags_known
    check (access_tags <@ array['acessivel', 'lgbtqia', 'pet-friendly', 'vegano']::text[]);

drop function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz);

create function public.search_events(
  p_lat         double precision,
  p_lng         double precision,
  p_radius_km   double precision,
  p_genre_slugs text[]      default null,
  p_price_max   numeric     default null,
  p_date_from   timestamptz default null,
  p_date_to     timestamptz default null,
  p_artist_id   uuid        default null,
  p_area        text        default null,
  p_query       text        default null,
  p_sort        text        default 'date',
  p_limit       int         default 20,
  p_offset      int         default 0,
  p_now         timestamptz default now(),
  p_tags        text[]      default null
)
returns table (
  id                 uuid,
  title              text,
  venue_id           uuid,
  starts_at          timestamptz,
  ends_at            timestamptz,
  price_min          numeric,
  price_max          numeric,
  is_free            boolean,
  ticket_url         text,
  age_min            int,
  status             public.event_status,
  cover_key          text,
  image_url          text,
  popularity         int,
  genre_slugs        text[],
  access_tags        text[],
  artist_ids         uuid[],
  venue_slug         text,
  venue_name         text,
  venue_area         text,
  venue_city         text,
  venue_address      text,
  venue_lat          double precision,
  venue_lng          double precision,
  venue_status       public.venue_status,
  venue_adult_only   boolean,
  venue_genre_slugs  text[],
  venue_hours        text,
  venue_cover_key    text,
  venue_placeholder  boolean,
  distance_km        double precision,
  total_count        int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with params as (
    select
      public.fold_text(nullif(btrim(p_query), '')) as q,
      nullif(p_area, '')                           as area,
      case when p_genre_slugs is null or cardinality(p_genre_slugs) = 0
           then null else p_genre_slugs end         as genres,
      case when p_tags is null or cardinality(p_tags) = 0
           then null else p_tags end                as tags,
      coalesce(p_sort, 'date')                     as sort,
      greatest(coalesce(p_limit, 20), 0)           as lim,
      greatest(coalesce(p_offset, 0), 0)           as off
  ),
  candidates as (
    select
      e.*,
      v.slug        as v_slug,
      v.name        as v_name,
      v.area        as v_area,
      v.city        as v_city,
      v.address     as v_address,
      v.lat         as v_lat,
      v.lng         as v_lng,
      v.status      as v_status,
      v.adult_only  as v_adult_only,
      v.genre_slugs as v_genre_slugs,
      v.hours       as v_hours,
      v.cover_key   as v_cover_key,
      v.placeholder as v_placeholder,
      v.access_tags as v_access_tags,
      public.haversine_km(p_lat, p_lng, v.lat, v.lng) as dist
    from public.events e
    join public.venues v on v.id = e.venue_id
    cross join params p
    where e.status = 'published'
      and v.status <> 'closed'
      and e.starts_at >= coalesce(p_date_from, p_now)
      and (p_date_to is null or e.starts_at <= p_date_to)
      and (p.area is null or lower(v.area) = lower(p.area))
      and (p_artist_id is null or exists (
            select 1 from public.event_artists ea
            where ea.event_id = e.id and ea.artist_id = p_artist_id))
      and (p.genres is null or exists (
            select 1 from public.event_genres eg
            where eg.event_id = e.id and eg.genre_slug = any (p.genres)))
      and (p.tags is null or (e.access_tags || v.access_tags) @> p.tags)
      and (p_price_max is null
           or e.is_free
           or (p_price_max > 0 and e.price_min is not null and e.price_min <= p_price_max))
      and (p.q is null
           or strpos(public.fold_text(e.title), p.q) > 0
           or strpos(public.fold_text(v.name), p.q) > 0
           or exists (
                select 1 from public.event_artists ea
                join public.artists a on a.id = ea.artist_id
                where ea.event_id = e.id and strpos(public.fold_text(a.name), p.q) > 0))
  ),
  filtered as (
    select c.*, round(c.dist::numeric, 3)::double precision as dist_r
    from candidates c
    where p_radius_km is null or c.dist <= p_radius_km
  ),
  ranked as (
    select
      f.*,
      count(*) over () as total,
      row_number() over (
        order by
          case when p.sort = 'distance' then f.dist_r end asc nulls last,
          case when p.sort = 'price' then
            case when f.is_free then 0::numeric else f.price_min end
          end asc nulls last,
          case when p.sort = 'popularity' then f.popularity end desc nulls last,
          f.starts_at asc,
          f.id asc
      ) as rn
    from filtered f
    cross join params p
  )
  select
    r.id, r.title, r.venue_id, r.starts_at, r.ends_at,
    r.price_min, r.price_max, r.is_free, r.ticket_url, r.age_min,
    r.status, r.cover_key, r.image_url, r.popularity,
    coalesce((
      select array_agg(eg.genre_slug order by g.sort_order, eg.genre_slug)
      from public.event_genres eg
      join public.genres g on g.slug = eg.genre_slug
      where eg.event_id = r.id), '{}'::text[]) as genre_slugs,
    coalesce((
      select array_agg(t order by array_position(
        array['acessivel', 'lgbtqia', 'pet-friendly', 'vegano']::text[], t))
      from (select distinct unnest(r.access_tags || r.v_access_tags) as t) u), '{}'::text[]) as access_tags,
    coalesce((
      select array_agg(ea.artist_id order by ea.billing_order, ea.artist_id)
      from public.event_artists ea
      where ea.event_id = r.id), '{}'::uuid[]) as artist_ids,
    r.v_slug, r.v_name, r.v_area, r.v_city, r.v_address, r.v_lat, r.v_lng,
    r.v_status, r.v_adult_only, r.v_genre_slugs, r.v_hours, r.v_cover_key, r.v_placeholder,
    r.dist_r as distance_km,
    r.total::int as total_count
  from ranked r
  cross join params p
  where r.rn > p.off and r.rn <= p.off + p.lim
  order by r.rn
$$;

comment on function public.search_events is
  'Event search for the app. Semantics mirrored by app/src/data/seedRepo.ts; fixtures in supabase/tests/fixtures. p_tags: AND over venue + event access_tags.';

revoke execute on function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz, text[]) from public;
grant execute on function public.search_events(
  double precision, double precision, double precision, text[], numeric,
  timestamptz, timestamptz, uuid, text, text, text, int, int, timestamptz, text[])
  to anon, authenticated, service_role;
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:sql`
Expected: all pass, including the 7 new tests in `access-tags.test.ts`. If an older SQL test names a column order or counts RPC columns, update that assertion to the new `access_tags` column.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0009_access_tags.sql supabase/tests supabase/seed/sql.ts
git commit -m "feat(supabase): access tags columns and p_tags filter in search_events (0009)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Seed tags, SQL oracle and fixtures

**Files:**
- Modify: `supabase/seed/seed-data.ts`
- Modify: `supabase/tests/reference.ts`
- Modify: `supabase/seed/build.ts`
- Regenerate: `supabase/seed/seed.sql`, `app/src/data/seed.json`, `supabase/tests/fixtures/seed-fixed.json`, `supabase/tests/fixtures/search-cases.json`

- [ ] **Step 1: Add demo tags to venues**

In `supabase/seed/seed-data.ts`, add an `accessTags` line inside each `VENUES` entry (after its `genreSlugs` line):

| venue slug | line to add |
|---|---|
| `bolt` | `accessTags: ['lgbtqia'],` |
| `a-selva` | `accessTags: ['lgbtqia', 'vegano'],` |
| `gordinho` | `accessTags: ['pet-friendly'],` |
| `pub-426` | `accessTags: ['acessivel', 'vegano'],` |
| `fluente` | (none) |
| `correria-music-bar` | `accessTags: ['pet-friendly'],` |
| `casa-caipora` | (none) |
| `casa-mare` | `accessTags: ['acessivel', 'lgbtqia', 'vegano'],` |

In the `buildSeed` venues map, keep tags clean: change

```ts
  const venues: Venue[] = VENUES.map((v) => ({
    ...v,
    id: venueId(v.slug),
    genreSlugs: sortGenres(v.genreSlugs),
    placeholder: true,
  }));
```

to

```ts
  const venues: Venue[] = VENUES.map((v) => ({
    ...v,
    id: venueId(v.slug),
    genreSlugs: sortGenres(v.genreSlugs),
    accessTags: cleanTags(v.accessTags),
    placeholder: true,
  }));
```

and add at the top with the other imports: `import { cleanTags } from '../../app/src/domain/accessTags';`

Give one event its own tag so the override path is exercised. In `DEMO_LIVE` add an optional `accessTags?: AccessTag[]` to the element type (add `import type { AccessTag } from '../../app/src/domain/accessTags';`), set it on the `em-breve` entry (`accessTags: ['pet-friendly']`), and in the `demoLive` mapper add after `popularity: d.popularity,`:

```ts
          accessTags: cleanTags(d.accessTags),
```

(The `DEMO_LIVE` type line becomes `{ key: string; title: string; startH: number; endH: number; genres: string[]; artists: string[]; price: [number, number]; popularity: number; accessTags?: AccessTag[] }[]` and the `em-breve` object gains `, accessTags: ['pet-friendly']`.)

- [ ] **Step 2: Update the SQL oracle and add fixture cases**

In `supabase/tests/reference.ts`: add `import { effectiveTags, matchesTags } from '../../app/src/domain/accessTags';` and, right after the `if (genres && …) continue;` line, add:

```ts
    if (!matchesTags(effectiveTags(v, e), p.tags)) continue;
```

In `supabase/seed/build.ts`, inside `searchCaseParams` after the `'empty genre list = no filter'` case add:

```ts
    c('tag acessivel (venue tag)', { tags: ['acessivel'], limit: 100 }),
    c('tags acessivel AND vegano', { tags: ['acessivel', 'vegano'], limit: 100 }),
    c('tag pet-friendly (venue and event override)', { tags: ['pet-friendly'], limit: 100 }),
    c('empty tag list = no filter', { tags: [], limit: 5 }),
```

- [ ] **Step 3: Cross-check the oracle in the search test**

In `supabase/tests/search.test.ts`, find the existing block that compares SQL against `referenceSearch` for a list of param sets (search for `referenceSearch(`). Add to that list a tags case, following the exact shape used there, e.g. `{ ...base, tags: ['lgbtqia'] }` and `{ ...base, tags: ['acessivel', 'vegano'] }`. Run `npm run test:sql` to see the block; if the file loops over `searchCaseParams`, no edit is needed because Step 2 already added the cases.

- [ ] **Step 4: Regenerate seed and fixtures**

Run: `npm run seed -- --fixtures`
Expected output includes `wrote supabase/seed/seed.sql`, `wrote app/src/data/seed.json`, `wrote supabase/tests/fixtures/seed-fixed.json`, `wrote supabase/tests/fixtures/search-cases.json`, and `36 search cases` (32 + 4).

Check the diff is only tag-related plus the new cases: `git diff --stat` and `git diff supabase/tests/fixtures/search-cases.json | head -60`. Existing cases must keep their `expectedEventIds`.

- [ ] **Step 5: Run SQL tests**

Run: `npm run test:sql`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase app/src/data/seed.json
git commit -m "feat(seed): demo access tags, oracle support and tag search cases" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Repos (seed, feed, Supabase) with parity

**Files:**
- Modify: `app/src/data/seedRepo.ts`
- Modify: `app/src/data/feedRepo.ts`
- Modify: `app/src/data/supabaseRepo.ts`
- Test: `app/src/data/parity.test.ts` (existing, now covers new cases), `app/src/data/seedRepo.test.ts`, `app/src/data/feedRepo.test.ts`, `app/src/data/supabaseRepo.test.ts`

- [ ] **Step 1: Run parity to see it fail**

Run: `npx jest src/data/parity.test.ts`
Expected: FAIL on the four new tag cases (SeedRepo ignores `tags`).

- [ ] **Step 2: SeedRepo**

In `app/src/data/seedRepo.ts` add `import { effectiveTags, matchesTags } from '@/domain/accessTags';` and, directly after the line `if (genres && !event.genreSlugs.some((g) => genres.has(g))) continue;`, add:

```ts
      if (params.tags?.length && !matchesTags(effectiveTags(venue, event), params.tags)) continue;
```

- [ ] **Step 3: SupabaseRepo**

In `app/src/data/supabaseRepo.ts`:

1. Add `import { cleanTags } from '@/domain/accessTags';`
2. In `mapVenue`, after the `genreSlugs:` line add: `accessTags: cleanTags(pick<string[] | null>(r, 'access_tags', 'accessTags')),`
3. In `mapEvent`, after the `genreSlugs,` line add: `accessTags: cleanTags(pick<string[] | null>(r, 'access_tags', 'accessTags')),`
4. In `searchEvents`, replace the spread at the end of the RPC args

```ts
        ...(params.now ? { p_now: params.now } : {}),
```

with

```ts
        ...(params.now ? { p_now: params.now } : {}),
        // Only send p_tags when set, so unfiltered searches also work against a database that has not run 0009 yet.
        ...(params.tags?.length ? { p_tags: params.tags } : {}),
```

Do not change `mapSearchRow`: the RPC's `access_tags` column is read by `mapEvent`; the venue gets none, and the UI unions both.

- [ ] **Step 4: FeedRepo**

In `app/src/data/feedRepo.ts` add `import { cleanTags } from '@/domain/accessTags';` and change the final return of `validateFeed` to sanitise tags (unknown slugs are dropped, never rejected):

```ts
  const withTags = <T extends { accessTags?: unknown }>(row: T) =>
    row.accessTags === undefined ? row : { ...row, accessTags: cleanTags(row.accessTags) };
  return {
    generatedAt: raw.generatedAt,
    genres: goodGenres,
    venues: goodVenues.map(withTags),
    artists: goodArtists,
    events: goodEvents.map(withTags),
  };
```

If `FeedRepo` has its own search implementation instead of delegating to `SeedRepo`, apply the same one-line `matchesTags(effectiveTags(venue, event), params.tags)` filter there (`grep -n "genreSlugs" app/src/data/feedRepo.ts` shows where; the earlier grep found only validators, which means it delegates to `SeedRepo` and needs no extra filter).

- [ ] **Step 5: Unit tests for repos**

Append to `app/src/data/seedRepo.test.ts` (use the file's existing `repo`/dataset setup; if it builds a repo from `miniDataset`, first add tags to the mini fixture in Step 6 of Task 7; here use an inline dataset):

```ts
describe('SeedRepo tags', () => {
  const ds = {
    ...miniDataset,
    venues: miniDataset.venues.map((v) => (v.id === 'v1' ? { ...v, accessTags: ['acessivel' as const] } : v)),
    events: miniDataset.events.map((e) => (e.id === 'e02' ? { ...e, accessTags: ['vegano' as const] } : e)),
  };
  const repo = new SeedRepo(ds, () => Date.parse(MINI_NOW));
  const base = { lat: -20.299, lng: -40.295, radiusKm: 50, sort: 'date' as const, limit: 100, now: MINI_NOW };

  it('matches venue tags and event tags, ANDed', async () => {
    const venueTag = await repo.searchEvents({ ...base, tags: ['acessivel'] });
    expect(venueTag.items.length).toBeGreaterThan(0);
    expect(venueTag.items.every((i) => i.venue.id === 'v1')).toBe(true);
    const eventTag = await repo.searchEvents({ ...base, tags: ['vegano'] });
    expect(eventTag.items.map((i) => i.event.id)).toEqual(['e02']);
    const both = await repo.searchEvents({ ...base, tags: ['acessivel', 'vegano'] });
    expect(both.items).toEqual([]);
  });
});
```

Add the needed imports at the top of that file if absent: `import { miniDataset, MINI_NOW } from './__fixtures__/mini';` and `import { SeedRepo } from './seedRepo';`.

Append to `app/src/data/feedRepo.test.ts` (reuse the file's feed-building helper; show with a direct call):

```ts
describe('validateFeed tags', () => {
  it('keeps known tags and drops unknown ones without rejecting the row', () => {
    const feed = {
      ...miniDataset,
      venues: miniDataset.venues.map((v) => (v.id === 'v1' ? { ...v, accessTags: ['vegano', 'nope'] } : v)),
    };
    const out = validateFeed(feed);
    expect(out).not.toBeNull();
    expect(out!.venues.find((v) => v.id === 'v1')!.accessTags).toEqual(['vegano']);
    expect(out!.venues.find((v) => v.id === 'v2')!.accessTags).toBeUndefined();
  });
});
```

(Import `validateFeed` from `./feedRepo` and `miniDataset` from `./__fixtures__/mini` if the file does not already.)

Append to `app/src/data/supabaseRepo.test.ts`, following that file's existing fake-client pattern for `rpc` (it already asserts the args passed to `search_events`): add two tests: one calling `searchEvents({ ...params, tags: ['acessivel'] })` and expecting the rpc args to contain `p_tags: ['acessivel']`; one without tags expecting `'p_tags' in args` to be `false`. Also assert `mapSearchRow({ ...row, access_tags: ['acessivel', 'vegano'] }).event.accessTags` equals `['acessivel', 'vegano']`.

- [ ] **Step 6: Run tests**

Run: `npx jest src/data && npm run typecheck`
Expected: all PASS including the four new parity cases; typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/src/data
git commit -m "feat(tags): AND tag filter in seed, feed and Supabase repos" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Filtros UI section

**Files:**
- Modify: `app/src/data/__fixtures__/mini.ts`
- Modify: `app/src/features/filtros/Sections.tsx`
- Test: `app/src/features/filtros/__tests__/filtros.test.tsx`

- [ ] **Step 1: Tag the mini fixture**

In `app/src/data/__fixtures__/mini.ts`, add `accessTags: ['acessivel', 'vegano'],` to venue `v1` and `accessTags: ['vegano'],` to venue `v2` (after their `genreSlugs` entries). Venues `v3` and `v4` stay untagged.

- [ ] **Step 2: Write the failing test**

In `app/src/features/filtros/__tests__/filtros.test.tsx`, add inside `describe('Filtros', …)`:

```ts
  it('"Vibe & acesso" chips toggle tags and narrow the live count', async () => {
    await renderWithData(<FiltrosScreen />);
    expect(screen.getByText('Vibe & acesso')).toBeOnTheScreen();
    const all = await screen.findByText(/^Ver \d+ eventos$/);
    const total = Number(all.props.children.toString().match(/\d+/)![0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Acessível' }));
    expect(useFilters.getState().filters.tags).toEqual(['acessivel']);
    const narrowed = await screen.findByText(/^Ver \d+ eventos?$/);
    expect(Number(narrowed.props.children.toString().match(/\d+/)![0])).toBeLessThan(total);
    await fireEvent.press(screen.getByRole('button', { name: 'Acessível' }));
    expect(useFilters.getState().filters.tags).toEqual([]);
  });
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx jest src/features/filtros -t "Vibe"`
Expected: FAIL (`Unable to find an element with text: Vibe & acesso`).

- [ ] **Step 4: Implement the section**

In `app/src/features/filtros/Sections.tsx`:

1. Add `import { ACCESS_TAGS } from '@/domain/accessTags';`
2. Add `const toggleTag = useFilters((s) => s.toggleTag);` beside `toggleGenre`.
3. Insert this section between the "Gênero" and "Região" sections:

```tsx
      <Section title="Vibe & acesso">
        <View style={styles.chips}>
          {ACCESS_TAGS.map((t) => (
            <Chip key={t.slug} label={t.label} selected={filters.tags.includes(t.slug)} onPress={() => toggleTag(t.slug)} />
          ))}
        </View>
      </Section>
```

- [ ] **Step 5: Run tests**

Run: `npx jest src/features/filtros src/features/explorar && npm run typecheck`
Expected: PASS. The earlier test that lists section titles is unaffected (it checks presence, not exact set).

- [ ] **Step 6: Commit**

```bash
git add app/src/data/__fixtures__/mini.ts app/src/features/filtros
git commit -m "feat(filtros): Vibe & acesso chip section" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Badges on Evento and Casa, empty state

**Files:**
- Create: `app/src/features/evento/AccessBadges.tsx`
- Modify: `app/src/features/evento/EventoScreen.tsx`
- Modify: `app/src/features/casa/CasaScreen.tsx`
- Modify: `app/src/features/explorar/EmptyResults.tsx`
- Test: `app/src/features/evento/__tests__/detail.test.tsx`, `app/src/features/explorar/__tests__/explorar.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `app/src/features/evento/__tests__/detail.test.tsx` add inside `describe('EventoScreen', …)`:

```ts
  it('shows the venue and event access tags as text badges', async () => {
    await renderWith(<EventoScreen id="e01" />);
    expect(await screen.findByText('Acessível')).toBeTruthy();
    expect(screen.getByText('Opção vegana')).toBeTruthy();
    expect(screen.queryByText('Pet friendly')).toBeNull();
  });
```

and in the `CasaScreen` describe of the same file:

```ts
  it('shows the venue access tags', async () => {
    await renderWith(<CasaScreen slug="bolt" />);
    expect(await screen.findByText('Acessível')).toBeTruthy();
    expect(screen.getByText('Opção vegana')).toBeTruthy();
  });
```

(`bolt` is mini venue `v1`, tagged in Task 6; `e01` is at `v1`.)

In `app/src/features/explorar/__tests__/explorar.test.tsx`, find the existing EmptyResults test (search for `Nada aceso por aqui`) and add after it:

```ts
  it('empty results name an active tag in the explanation', async () => {
    useFilters.getState().set({ tags: ['pet-friendly'] });
    await renderWithData(<EmptyResults />);
    expect(screen.getByText(/Pet friendly/)).toBeOnTheScreen();
  });
```

Use the same imports/helpers that existing EmptyResults test in that file uses (`renderWithData`, `useFilters`, `EmptyResults`); add whichever is missing.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest src/features/evento src/features/explorar`
Expected: FAIL on the three new tests.

- [ ] **Step 3: Implement `AccessBadges`**

Create `app/src/features/evento/AccessBadges.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

import { tagLabel, type AccessTag } from '@/domain/accessTags';
import { space } from '@/theme/tokens';
import { Tag } from '@/ui';

/** Text-only badges for vibe & access tags. Renders nothing when there are none. */
export function AccessBadges({ tags }: { tags: AccessTag[] }) {
  if (!tags.length) return null;
  return (
    <View style={styles.row} accessibilityLabel="Vibe e acesso">
      {tags.map((t) => (
        <Tag key={t} label={tagLabel(t)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
```

- [ ] **Step 4: Wire into Evento and Casa**

In `EventoScreen.tsx`: add `import { effectiveTags } from '@/domain/accessTags';` and `import { AccessBadges } from './AccessBadges';`. Directly after the closing of the genre tags block (`) : null}` that follows `{tags.map(...)}`; i.e. just before `<Text variant="display" accessibilityRole="header">`), insert:

```tsx
        <AccessBadges tags={effectiveTags(venue, event)} />
```

In `CasaScreen.tsx`: add `import { effectiveTags } from '@/domain/accessTags';` and `import { AccessBadges } from '@/features/evento/AccessBadges';`. Directly after the `</View>` that closes the `styles.tags` genre block (the one containing `genreLabels(venue.genreSlugs, genres)`), insert:

```tsx
        <AccessBadges tags={effectiveTags(venue, {})} />
```

- [ ] **Step 5: Empty state**

In `app/src/features/explorar/EmptyResults.tsx`:

1. Add `import { tagLabel } from '@/domain/accessTags';`
2. Extend `describe(...)`: find the function whose signature is `describe(f: FilterState, labels: string[])` (the code above `parts.push('para "…"')`) and, right after the genre label is pushed (before the price lines), add:

```ts
  if (f.tags.length) parts.push(`com ${f.tags.map(tagLabel).join(' e ')}`);
```

   Keep the existing ordering/spacing helpers; `parts` is an array of fragments joined with a space.
3. In the component, change the message so tags are named in the recovery hint: replace `Tente abrir o raio ou tirar um filtro.` with `Tente abrir o raio${filters.tags.length ? ', tirar um selo' : ''} ou tirar um filtro.`

- [ ] **Step 6: Run tests**

Run: `npx jest src/features && npm run typecheck && npm run lint`
Expected: PASS; typecheck exit 0; lint 0 errors.

- [ ] **Step 7: Commit**

```bash
git add app/src/features
git commit -m "feat(tags): access badges on Evento and Casa, tag-aware empty state" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Docs

**Files:**
- Modify: `supabase/README.md`, `docs/DESIGN.md`, `README.md`, `docs/superpowers/specs/2026-10-29-vibe-access-filters-design.md`

- [ ] **Step 1: Update docs**

- `supabase/README.md`: in the `search_events` section, add `p_tags text[]` (AND over `venues.access_tags || events.access_tags`, null/empty = no filter) and the `access_tags` return column; mention migration `0009`.
- `docs/DESIGN.md`, section 4 (Component Stylings), add one bullet: `- **Vibe & acesso:** Filtros section of four text chips (Acessível, LGBTQIA+ friendly, Pet friendly, Opção vegana); Evento and Casa show the same labels as text Tags below the genres. Match is AND. Tags on demo venues are demonstration data.`
- `README.md`: in "What exists", add `vibe & acesso filters` after `Quando`, and change `migrations 0001–0008` to `0001–0009`.
- Spec: in "Domain and repos", replace the sentence beginning "`supabase/seed/build.ts` assigns demo tags… and `ingest/` feed schema accepts optional `accessTags` and ignores unknown slugs." with "`supabase/seed/seed-data.ts` assigns demo tags to venues and one event; the ingest feed already passes optional fields through and the app's `validateFeed` drops unknown slugs, so `ingest/` is unchanged." Also change "`Venue.accessTags`, `Event.accessTags` (effective set)" to "`Venue.accessTags?`, `EventItem.accessTags?` (own tags; the RPC returns the effective set) and `effectiveTags()`".

- [ ] **Step 2: Commit**

```bash
git add supabase/README.md docs README.md
git commit -m "docs: vibe & access filters" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification and PR

- [ ] **Step 1: Run the whole CI gate locally**

Run: `npm run typecheck && npm run lint && npm test -- --ci && npm run test:sql && npx expo export --platform web`
Expected: typecheck exit 0; lint 0 errors; all jest suites pass; all SQL tests pass; `Exported: dist`.

If typecheck reports errors in `.expo/types/router.d.ts` routes, delete that ignored generated file (`Remove-Item .expo\types\router.d.ts`) and rerun; CI never has it.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feat/vibe-access-filters
gh pr create --base master --title "feat: vibe & access filters" --body "$(cat <<'EOF'
## Summary
Four tags (Acessível, LGBTQIA+ friendly, Pet friendly, Opção vegana) on venues and events, a "Vibe & acesso" section in Filtros (AND match), badges on Evento and Casa, and migration 0009 (columns, CHECKs, `search_events` with `p_tags`).

Spec: docs/superpowers/specs/2026-10-29-vibe-access-filters-design.md

## Rollout
Apply migration 0009 to the remote Supabase project before shipping an app build; unfiltered searches never send `p_tags`, so they work either way.

Tags on demo venues are demonstration data, not verified.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI, then stop for a human**

Run: `gh pr checks --watch`
Expected: `check` and Vercel pass. Do **not** merge or apply the migration to the remote Supabase project without Pedro's explicit go-ahead; both are outward-facing. After approval: apply `0009_access_tags.sql` to the remote project first (Supabase `apply_migration`), run `npm run test:remote`, then merge.

---

## Self-review

- **Spec coverage:** tags + labels (Task 1); AND semantics and URL/count/params (Tasks 1-2, 3, 5); venue+event union and CHECKs (Task 3); migration/RPC/grants (Task 3); seed demo tags and honesty note (Tasks 4, 8); repos seed/feed/Supabase and parity (Task 5); UI section, badges, empty state (Tasks 6-7); testing list (Tasks 1-7); rollout order (Task 9). Ingest handled by the documented spec correction in Task 8.
- **Placeholders:** none. Two steps (Task 4 Step 3, Task 5 Step 5 `supabaseRepo.test.ts`, Task 7 EmptyResults `describe` edit) adapt to existing file helpers whose exact text is not reproduced here; each states the exact assertion/line to add and where it goes.
- **Type consistency:** `AccessTag`, `ACCESS_TAGS`, `cleanTags`, `effectiveTags(venue, event)`, `matchesTags(have, wanted)`, `tagLabel`, `FilterState.tags`, `SearchParams.tags`, `toggleTag`, RPC `p_tags` / `access_tags` are used identically across tasks.
