# Qual a boa?

Nightlife discovery app for Vitória, ES (Brazil): browse clubs and parties by music style, ticket price, distance and the artists who played there. Expo (React Native, iOS + Android + web), Supabase backend. pt-BR.

> Status: MVP in progress. Venue, event and artist data is demonstration data shown without UI tags (owner decision, Wave 7; the Terms disclose it during the pilot, see `docs/VENUES.md`); nothing here is verified with the venues. Legal risk: verify with each venue before launch.

## What exists
- `app/`: Expo SDK 58 app. Screens built so far: age gate and onboarding, Explorar, Filtros, Mapa, Evento, Casa, Artista, Salvos, Perfil, UI gallery (`/dev/ui`). Tracking, reviews and support screens are stubs.
- `supabase/`: migrations (schema, `search_events`, RLS, history views), seed generator and local SQL tests (PGlite). No remote project is attached.
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
- Android maps need a Google Maps API key (`react-native-maps` plugin option in `app.json`); not included.
- iOS and Android builds have not been run yet; web is the verified target.
- See `docs/ARCHITECTURE.md` for folder layout and conventions.
