# Qual a boa?

Nightlife discovery app for Vitória, ES (Brazil): browse clubs and parties by music style, ticket price, distance and the artists who played there. Expo (React Native, iOS + Android + web), Supabase backend. pt-BR.

> Status: MVP in progress. Venue, event and artist data is demonstration data shown without UI tags (owner decision, Wave 7; the Terms disclose it during the pilot, see `docs/VENUES.md`); nothing here is verified with the venues. Legal risk: verify with each venue before launch.

## What exists
- `app/`: Expo SDK 58 app. Screens: age gate and onboarding, Explorar, Filtros, Mapa, Evento, Casa, Artista, Salvos, Perfil, Acompanhar, Ao vivo, Avaliar/Avaliações, Ajuda, Entrar (e-mail code), Minha conta (name, export, erase), Meus eventos, Busca (events, venues, artists, recent searches), Quando (date sheet with calendar), Ingressos (pre-checkout handoff), Chamar a galera (invite sheet), Privacidade e dados, offline banner, UI gallery (`/dev/ui`). Still missing: photo uploads in the UI (backend ready).
- `supabase/`: migrations 0001–0008 (schema, `search_events`, RLS, history views, engagement, catalog ingest, photo-upload buckets, `search_artists`), the `delete-account` Edge Function (`supabase/functions`), seed generator and local SQL tests (PGlite). A remote project is attached; see `supabase/README.md`.
- `ingest/`: event ingestion CLI that produces the static feed in `app/public/feed/v1`.
- `docs/`: design system (`DESIGN.md`), venue research, design audit, architecture and file ownership, and the HTML design mockups (`design-canvas/`).

## Run
```bash
cd app
npm install
npm run web          # or: npm run ios / npm run android
npm run typecheck && npm run lint && npm test
npm run test:sql     # backend tests, no database needed
npm run seed         # regenerate seed data (dates are relative to today)
```
Data source defaults to the built-in seed. Copy `app/.env.example` to `app/.env` to point at a Supabase project later.

## Notes
- The map uses MapLibre with OpenFreeMap tiles, so no map API key is needed.
- Web is the verified target. Android has been built (R8 startup fix landed); iOS has not been run yet.
- See `docs/ARCHITECTURE.md` for folder layout and conventions.
