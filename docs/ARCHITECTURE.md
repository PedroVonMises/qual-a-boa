# Architecture and ownership

Stack: Expo SDK 58, expo-router, React Native 0.88, React 19.3, TypeScript strict, TanStack Query, zustand. Backend: Supabase (Postgres 17), validated locally with PGlite (no remote project yet). Language: pt-BR. Pilot: Vitória, ES.

## Layout
```
app/app/        routes only, thin (expo-router). Imports from src/features and src/ui.
app/src/theme   tokens.ts (single source of design values), fonts.ts, ThemeProvider
app/src/ui      design-system components, no data access
app/src/domain  types.ts, format.ts, filters.ts (pure)
app/src/data    repo.ts (interface), seedRepo.ts, supabaseRepo.ts, queries.ts, seed.json (generated)
app/src/state   zustand stores
app/src/features/<name>   screen-level components per feature
app/src/lib     env.ts, analytics.ts, a11y helpers
supabase/       migrations/, seed/, tests/  (own: backend agent)
docs/           DESIGN.md (design system), SCREENS.md + screens/ (screen inventory), VENUES.md, design-audit.md, this file
```
Path alias: `@/` maps to `app/src/`. Routes live in `app/app/` (scaffold convention; AGENTS.md mentions `src/app`, we deliberately keep routes outside `src`).

## File ownership (parallel agents must not edit outside their paths)
| Owner | Paths |
|---|---|
| Orchestrator | `app/package.json`, `app/package-lock.json`, `app/tsconfig.json`, `app/eslint.config.js`, `app/.env.example`, `docs/ARCHITECTURE.md`, merges |
| A Backend | `supabase/**` (migrations, seed generator, SQL tests), writes `app/src/data/seed.json` only via `npm run seed` |
| B Design system | `app/src/ui/**`, `app/src/theme/**` (except tokens.ts values: change only via docs/DESIGN.md and tell the orchestrator) |
| C Data + state | `app/src/data/**` (except seed.json), `app/src/state/**`, `app/src/domain/**` |
| D Shell | `app/app/**`, `app/app.json`, `app/eas.json`, `app/assets/**` |
| Wave 2+ feature agents | `app/src/features/<own>/**` and the route files they are assigned |

Need a new dependency? Do not edit package.json. Put it in your report; the orchestrator installs with `npx expo install`.

## Contracts (do not change without the orchestrator)
- `app/src/domain/types.ts` domain types; `app/src/data/repo.ts` the `Repo` interface. UI and hooks depend on these only.
- `EXPO_PUBLIC_DATA_SOURCE=seed|supabase` selects the Repo (default seed).
- Money is BRL reais, dates ISO UTC, distances in km, labels pt-BR.

## Rules for every agent
1. Read `app/AGENTS.md`. Before using any Expo/RN API, fetch the SDK 58 docs (`https://docs.expo.dev/versions/v58.0.0/`, `https://docs.expo.dev/llms.txt`, append `.md` for markdown). Do not rely on memory.
2. Use `@/theme/tokens` for every color, size and font. Text on Riot Pink is always `riotInk`, never bone. Touch targets >= 44. Status never by color alone. Respect Reduce Motion.
3. No emojis as icons. No invented reviews or live status for real venues; demonstration content uses Casa Maré only and shows no mock/illustrative tags (owner decision, Wave 7; the Terms disclose demonstration content during the pilot). `Venue.placeholder` stays in types/DB but no UI reads it.
4. Done means: `npm run typecheck`, `npm run lint`, `npm test` pass (and `npm run test:sql` for backend). Report `FAILED:` with output if not.
5. Report: <= 200 words, changed files, requested dependencies, open issues.

## Commands (run in `app/`)
`npm run typecheck` · `npm run lint` · `npm test` · `npm run test:sql` · `npm run seed` · `npx expo export --platform web` · `npx expo start --web`

## Visual spec
`docs/SCREENS.md` is the visual reference: screenshots of every implemented screen in UX-flow order, regenerated with `node app/scripts/capture-screens.mjs` (see the script header). `docs/DESIGN.md` documents the tokens and components as built.

History: `docs/design-canvas/*.dc.html` are the earlier design mockups (static HTML, open through a local http server). Screen map: Main/Filtros/Mapa/Evento/Casa = generic; HomeReal, FiltrosReal, MapaReal, Evento{Bolt,Selva,Gordinho}, Casa{Bolt,Selva,Gordinho,Caipora} = real-venue variants (R1-R10); Idade, Local, Salvos, Perfil, Artista, Vazio, Web = N1-N7; Acompanhar, Avisos, AoVivo, Avaliar, AvaliarTexto, Avaliacoes, Ajuda, Mensagens, Suporte, NovoChamado = U1-U10; Marca/Marca2/Splash/Social/Aplicacoes = brand; Busca, Quando, Ingressos, Compartilhar, Entrar, SemConexao, Privacidade = G1-G7 (routes `/busca`, Quando sheet in Explorar and Filtros, `/ingressos/[id]`, share sheet in Evento, `/entrar`, root `OfflineBanner`, `/privacidade`). Cover art SVGs: `app/assets/art/*.svg`, brand marks: `app/assets/brand/`.

## Wave 3 (engagement)
Contracts: `app/src/domain/engage.ts`. Local-first persisted zustand stores, one per feature, named `qab.<feature>`: `state/follows.ts` (+ `state/checkins.ts`), `state/live.ts`, `state/reviews.ts`, `state/support.ts`. Screens live in `src/features/<name>` and replace the `ScreenStub` bodies of the existing route files (do not rename routes).
| Agent | Owns | Routes |
|---|---|---|
| I Tracking | `features/acompanhar`, `features/aoVivo`, `state/follows.ts`, `state/checkins.ts`, `state/live.ts` | `acompanhar/*`, `ao-vivo/[id]` |
| J Feedback | `features/avaliar`, `features/avaliacoes`, `state/reviews.ts` | `avaliar/[id]/*`, `avaliacoes/[id]` |
| K Support | `features/ajuda`, `state/support.ts` | `ajuda/*` |
| A2 Backend | `supabase/migrations/0005_engage.sql`, `supabase/tests/engage.test.ts` | none |

## Wave 6 (free map, location, recommendations)
Map: OpenFreeMap tiles (no key) via `@maplibre/maplibre-react-native` (native) and `maplibre-gl` (web, lazy import), style in `features/mapa/mapStyle.ts`, constants in `mapConfig.ts`. Contracts: `domain/recommendTypes.ts` (recommender), `lib/location/types.ts` (location service), `features/mapa/mapTypes.ts` (`VenueMapProps`).
| Agent | Owns |
|---|---|
| 6-A Location | `lib/location/**`, `state/location.ts`, `features/onboarding/**`, `features/perfil/**`, `features/explorar/{AreaSheet,Header}.tsx` |
| 6-B Map | `features/mapa/{VenueMap*,mapTypes,mapStyle,mapConfig}.ts(x)` |
| 6-C Recommender | `domain/{recommend,filters}.ts`, `state/taste.ts`, `features/explorar/{Shelves,useSearch,useTasteProfile}`, `features/filtros/**`, `features/mapa/{MapaScreen,pins}.ts(x)` |

## Wave 7 (clean data tags, illustrated covers, real event ingestion)
Contracts: `CoverKey` is a string (`domain/types.ts`, legacy keys in `LEGACY_COVER_KEYS`), `EventItem.imageUrl?`, `Cover imageUrl?`, `lib/env.ts` (`dataSource seed|feed|supabase`, `feedUrl`, `demoTools`, `appEnv`), `ingest/src/types.ts` (`RawEvent`, `SourceAdapter`), `docs/INGESTION.md` (tiers and legal gate).
| Agent | Owns |
|---|---|
| 7-A Cleanup | mock tags in `ui/EventCard.tsx` and features (evento, casa, artista, salvos, mapa/VenuePanel, aoVivo, acompanhar, avaliacoes), `state/demo.ts`, `features/perfil` demo gating and legal text, `supabase/seed/seed-data.ts` titles/addresses, related tests and docs |
| 7-B Covers | `ui/art/**`, `ui/Cover.tsx`, `domain/cover.ts`, `ui/Gallery.tsx`, cover assignment in `supabase/seed/seed-data.ts` (via `coverFor`) |
| 7-C Feed + DB | `data/feedRepo.ts`, `data/index.ts`, perfil "atualizado" row, `supabase/migrations/0006_catalog_ingest.sql` and its tests |
| 7-D Ingest core | `ingest/src/**` except `adapters/{sympla-api,crawler}.ts`, `.github/workflows/ingest.yml`, `app/public/feed/v1/**` |
| 7-E Adapters | `ingest/src/adapters/{sympla-api,crawler}.ts` + tests, `docs/INGESTION.md` details |
