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
docs/           DESIGN.md (design system), VENUES.md, design-audit.md, this file
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
3. No emojis as icons. No invented reviews or live status for real venues; fictional demo content uses Casa Maré.
4. Done means: `npm run typecheck`, `npm run lint`, `npm test` pass (and `npm run test:sql` for backend). Report `FAILED:` with output if not.
5. Report: <= 200 words, changed files, requested dependencies, open issues.

## Commands (run in `app/`)
`npm run typecheck` · `npm run lint` · `npm test` · `npm run test:sql` · `npm run seed` · `npx expo export --platform web` · `npx expo start --web`

## Visual spec
`docs/design-canvas/*.dc.html` are the design mockups (static HTML, open through a local http server). Screen map: Main/Filtros/Mapa/Evento/Casa = generic; HomeReal, FiltrosReal, MapaReal, Evento{Bolt,Selva,Gordinho}, Casa{Bolt,Selva,Gordinho,Caipora} = real-venue variants (R1-R10); Idade, Local, Salvos, Perfil, Artista, Vazio, Web = N1-N7; Acompanhar, Avisos, AoVivo, Avaliar, AvaliarTexto, Avaliacoes, Ajuda, Mensagens, Suporte, NovoChamado = U1-U10; Marca/Marca2/Splash/Social/Aplicacoes = brand. Cover art SVGs: `app/assets/art/*.svg`, brand marks: `app/assets/brand/`.
