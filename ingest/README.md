# ingest/ - event ingestion for "Qual a boa?" (Espírito Santo)

Builds the public feed consumed by the app (`app/public/feed/v1/events.json` + `meta.json`) from curated submissions and public event pages. Node 20+, TypeScript strict, ESM. Policy, tiers and the legal gate for the crawler live in [`docs/INGESTION.md`](../docs/INGESTION.md).

```
adapters (manual | link | sympla-api | crawler)  ->  RawEvent[]
  -> normalize (venue match, BRL price, -03:00 -> UTC, genres, explicit artists)
  -> dedupe ((source, sourceId), then cross-source merge)
  -> approval (tier 1 auto, tier 2/3 via approved.json)
  -> lifecycle (cancelled / ended > 24 h dropped)
  -> app/public/feed/v1/{events,meta}.json   +   out/{candidates.json,summary.md,pr-title.txt}
```

## Run

```
cd ingest
npm ci
npm test            # offline, synthetic fixtures only
npm run typecheck
npm run ingest      # = tsx src/cli.ts run
npm run check       # validate data files + feed, no writes, no network
npm run demo        # whole CLI on the fixtures in a temp dir (offline)
```

`run` flags (or env): `--data DIR` (`INGEST_DATA_DIR`), `--out DIR`, `--feed DIR`, `--cache DIR`, `--offline` (cache only, never the network), `--fresh` (do not carry the previous feed forward), `--geocode`, `--now ISO`.

By default the previous feed is **carried forward** (so the fictional seed copy keeps the feed non-empty until real data exists). The cutover to real data is one run with `--fresh` (`INGEST_FRESH=1`). Events whose end passed more than 24 h ago are dropped either way.

If nothing changed, `generatedAt` and the files stay untouched, so quiet days open no PR.

## Add a public event page (tier 2)

```
npm run add -- https://example.com/evento/minha-festa
```

Appends the (https, tracking-params-stripped) URL to `data/links.txt`. On `run` each URL is fetched with `QualABoaBot/1.0`, after checking `robots.txt` (cached per host; disallowed or unreachable robots means no fetch), at most 1 request / 2 s per host, with responses cached in `.cache/` (6 h). 403/429 stops that host for the run. A 404/410 marks the event cancelled (if it is already published). Parsing: JSON-LD `Event` first (name, startDate, endDate, location name/address, offers lowPrice/highPrice/price in BRL, eventStatus, performer), then OpenGraph/`<title>` + `<time datetime>` + `itemprop=location`. Images are never used. Anything unparsable (no time of day, no venue, non-BRL price, postponed) is listed under `needsReview` in `out/candidates.json`, never guessed.

## Approve a record

Tier 2 (and 3) records are **not published** until approved. After `run`, open `out/candidates.json` (`pendingApproval[].key`, e.g. `link:3f2a9c1d5b7e0a44`) or the PR body, check the data and the page, then add the key to `data/approved.json`:

```json
["link:3f2a9c1d5b7e0a44"]
```

The next run publishes it. Un-approving does not retract an already published event (the feed carries events forward): retract by editing it out of `events.json` in the PR, or let it end. Cancellations found on a source page (404/410 or `EventCancelled`) apply to already-published events without approval.

## Curated submissions (tier 1)

Drop files in `data/curated/`. Tier 1 is auto-approved: only accept submissions from the venue/producer.

### JSON (`*.json`): an array, or `{ "events": [...] }`

| field | type | notes |
|---|---|---|
| `title` | string, required | |
| `venue` (or `venueName`) | string, required | matched to `data/venues.json` by name/alias/address, else an `unverified` draft venue |
| `address` (or `venueAddress`) | string | helps matching/draft venues |
| `startsAt` | ISO 8601 | `2026-11-14T23:00:00-03:00`; no zone means `-03:00`. Or use `date` + `start` |
| `endsAt` | ISO 8601 | optional; or `end` (time only, rolls past midnight) |
| `date`, `start`, `end` | `14/11/2026` or `2026-11-14`; `23:00`, `23h`, `23h30` | alternative to `startsAt`/`endsAt` |
| `priceMin`, `priceMax` | number or "R$ 30,00" | BRL reais |
| `price` | text | "R$ 30 a R$ 50", "R$ 40", "gratuito" |
| `isFree` | boolean | |
| `ageMin` | number | default 18 |
| `lineup` | string[] or "A; B" | only explicit artists are published |
| `url` | https URL | becomes `ticketUrl` |
| `description` | string | classification only, never published |
| `status` | `scheduled`, `cancelled`, `soldout` | `cancelled` cancels a published event |
| `sourceId` | string | stable id; default is a hash of title + start + venue. Set it if you may edit the title/time later |

Records that fail validation are reported under `needsReview`, not dropped silently.

### CSV (`*.csv`, Google Form export; `,` or `;`, UTF-8)

Header names are matched ignoring case and accents. Unknown columns (e.g. "Carimbo de data/hora") are ignored.

| field | accepted headers |
|---|---|
| title | Nome do evento, Evento, Título, Nome |
| venue | Local, Nome do local, Casa |
| address | Endereço |
| date | Data, Data do evento |
| start / end | Horário de início (Hora de início, Início) / Horário de término (Término, Fim) |
| priceMin / priceMax | Valor mínimo (Preço mínimo, Valor, Preço) / Valor máximo |
| free | Gratuito (Sim/Não) |
| age | Idade mínima, Classificação |
| lineup | Atrações, Line-up, Artistas (separated by `;`, `,` or new lines) |
| url | Link dos ingressos, Link |
| description / status | Descrição / Status |

## Data files

- `data/venues.json`: curated real venues. `id` is the slug (the app's venue id is the md5-v3 UUID of `venue:<slug>`, identical to the seed), plus `name`, `aliases[]`, `address`, `area`, `city`, `lat`, `lng`, `genreSlugs`, `status` (`open|unverified|closed`). Add aliases when a platform spells a venue differently.
- `data/genre-keywords.json`: keyword -> genre slug map for the classifier. Title + description are matched as whole words; with no match, the venue's first two genres are used.
- `data/links.txt`, `data/approved.json`, `data/curated/`.

## Rules the normalizer follows

- Times: `-03:00` (no DST) to UTC ISO. Date-only values are rejected, never given an invented hour.
- Prices in BRL reais. `isFree` when the price is 0 or the source says gratuito/grátis/entrada franca. Unknown price stays `null`/`null`.
- `ageMin` 18 unless stated. `ticketUrl` = source page, https only. `coverKey` is `generic` (the app computes covers). `popularity` 0..100: 50 base, +5 tier 1, +10 if top price >= R$120 (+5 if >= R$60), +4 per listed artist (max 3). `placeholder` is always `false`.
- Artists only from an explicit `lineup` or a clear "com A, B e C" phrase where every item looks like a name; never invented.
- Unknown venue: `unverified` draft at the city centroid (flagged `venue-location-approximate`). `--geocode` asks Nominatim once per venue (1 req/s, cached in `.cache/`, never in tests). Geocoding by Nominatim, data (c) OpenStreetMap contributors.
- Cross-source merge: same venue, starts within 2 h, token-Jaccard title similarity >= 0.6; the lower tier number wins and `sources` records all of them (see `out/candidates.json`).

## Tests

`npm test` runs `node:test` over hand-written fixtures in `test/fixtures` (no real pages, no network: a fake `fetch` throws on unexpected URLs). The golden file `test/golden/events.json` is regenerated with `UPDATE_GOLDEN=1 npm test` after an intended change.

## Adding adapters (agent E)

`src/adapters/index.ts` imports `./sympla-api.js` and `./crawler.js` lazily if they exist. Each may export `createAdapter(opts: AdapterFactoryOptions): SourceAdapter` (or a default/`adapter` export). An adapter may expose `report: AdapterReport` (`needsReview`, `gone`, `skipped`, `stats`). Source ids of the form `crawler:sympla` take the tier of the adapter `crawler`.
