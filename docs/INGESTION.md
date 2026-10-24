# Event ingestion (Espírito Santo)

Status: skeleton (Wave 7-0). Implementation: `ingest/` (agents 7-D, 7-E). Plan: Wave 7 in the project plan.

## Principles
- The app is a **discovery** layer: we show facts and link out to the official ticket page. We never sell, resell or proxy tickets.
- Prefer sources that **want** to be listed (venues, producers, official APIs). Public-page metadata only with a human review step. Crawling is off by default.
- Facts only: title, date/time, venue, price, age, link. No copied descriptions, no hotlinked third-party posters. Posters only when the organizer supplies them (permission); otherwise the illustrated cover is used.
- Never invent data: unknown lineup stays empty, unknown price stays "preço não divulgado".

## Source tiers
| Tier | Source | Publishing |
|---|---|---|
| 1 | `manual` submissions (venue/producer form or CSV), `sympla-api` with the organizer's own token | auto-approved |
| 2 | `link`: one public event page we were given (JSON-LD `Event` / OpenGraph), robots.txt respected | reviewed in the ingest PR |
| 3 | `crawler`: public listing pages, **disabled** | reviewed in the ingest PR, only after the legal gate below |

## Legal gate for tier 3 (crawler)
The crawler must not run until every box is checked by the project owner, per platform:
- [ ] Sympla Terms of Use read (could not be fetched during planning: HTTP 403) and automated access judged acceptable, or written permission obtained
- [ ] Blueticket / other platform Terms read, same judgement
- [ ] Takedown/contact page live (Perfil → Sobre) and monitored
- [ ] `INGEST_CRAWL=1` set deliberately in the workflow, with the platform added to the allow list in `ingest/src/adapters/crawler.ts`

## Politeness
User-Agent `QualABoaBot/1.0 (+https://qual-a-boa-lime.vercel.app/contato)`; `robots.txt` honored; at most 1 request per 2 s per host; stop on 403/429; cache responses; geocoding only through Nominatim's usage policy (1 req/s, cached, attribution).

## Publish flow
`npm run ingest` (in `ingest/`) → `ingest/out/candidates.json` + diff → GitHub Action opens a PR touching only `app/public/feed/v1/events.json` and `meta.json` → merge → Vercel redeploys → the app's `FeedRepo` refreshes (`EXPO_PUBLIC_FEED_URL`).

## Cutover from the fictional seed to real data
Default data source stays `seed` until the feed has at least N real upcoming events at 5+ real venues; then set `EXPO_PUBLIC_DATA_SOURCE=feed` for preview/production profiles in `app/eas.json` and Vercel. The fictional dataset remains for development.

## LGPD, takedown, retention
No personal data is ingested (organizer names are business names). A takedown request removes the event/venue within 48 h. Past events are kept for history views and pruned after 12 months.
