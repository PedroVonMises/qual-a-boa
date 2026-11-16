# Graph Report - qual-a-boa  (2026-11-16)

## Corpus Check
- 516 files · ~242,969 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .ttf 1)

## Summary
- 3287 nodes · 11539 edges · 126 communities (113 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 158 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6abda607`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui/index.ts
- useBreakpoint
- react
- Text
- Cover.tsx
- harness.ts
- isRemote
- acompanhar/__tests__/screens.test.tsx
- PressableScale
- NovaFestaScreen.tsx
- Icon
- DadosCadastraisScreen.tsx
- PerfilView.tsx
- data/casas.ts
- domain/types.ts
- state/demo.ts
- domain/filters.ts
- sync.remote.test.ts
- QuandoSheet.tsx
- useFilters
- ContaScreen.tsx
- seed-data.ts
- with
- VincularScreen.tsx
- app/_layout.tsx
- ExplorarScreen.tsx
- engage.ts
- normalize.ts
- pipeline.test.ts
- location/index.ts
- 0005_engage.sql
- feedRepo.ts
- recommend.ts
- pipeline.ts
- sync/community.ts
- expo
- 0010_community.sql
- acompanhar/logic.ts
- AssinaturaScreen.tsx
- LocalView.tsx
- public.events
- MeusEventosScreen.tsx
- SeedRepo
- domain/community.ts
- FiltrosScreen.tsx
- app-ci.yml
- EventoConversaScreen.tsx
- auth.ts
- FeedScreen.tsx
- capture-screens.mjs
- domain/casas.ts
- 0015_venue_accounts.sql
- BuscaScreen.tsx
- state/follows.ts
- location.ts
- manual.ts
- dependencies
- smoke
- link.ts
- useTasteProfile.ts
- VenueMap.tsx
- search.test.ts
- EventItem
- ingest/package.json
- comunidade/hooks.ts
- Event ingestion (Espírito Santo)
- app/package.json
- SupabaseRepo
- state/community.ts
- billing-checkout/handler.ts
- http.ts
- billing-webhook/handler.ts
- billing-checkout/index.ts
- address.ts
- VenueMapSchematic.tsx
- PainelScreen.tsx
- billing-webhook/index.ts
- feedStatus.ts
- venueMap.native.test.tsx
- adapters/index.ts
- deleteAccount
- Sheet
- billing.test.ts
- venue_accounts.test.ts
- devDependencies
- VenueMap.web.tsx
- Design System: Qual a boa?
- Screens: Qual a boa?
- compilerOptions
- 0007_uploads.sql
- scripts
- feed.remote.test.tsx
- Comunidade: event-scoped forum with "Mais útil" highlight
- @tanstack/react-query
- AppProviders.tsx
- getRepo
- feed.test.tsx
- draft.ts
- vercel.json
- Architecture and ownership
- shared.ts
- app/tsconfig.json
- fonts.ts
- eslint.config.js
- mapa.test.tsx
- Design audit — mockups (2026-10-22)
- AGENTS.md
- ResultBar.tsx
- jest
- VenuePin
- Qual a boa?
- supabase/
- Vitória nightlife research (for seed data and design placeholders)
- expo-build-properties@~58.0.11
- expo-haptics
- expo-image-picker
- expo-localization@~58.0.5
- react-dom@19.3.0
- react-native-web@~0.21.4
- react-native-worklets@0.13.0
- vercel-build.sh

## God Nodes (most connected - your core abstractions)
1. `Text()` - 230 edges
2. `useTheme()` - 180 edges
3. `react-native` - 149 edges
4. `react` - 108 edges
5. `Button()` - 103 edges
6. `space` - 92 edges
7. `Icon()` - 84 edges
8. `PressableScale()` - 77 edges
9. `expo-router` - 65 edges
10. `isRemote()` - 62 edges

## Surprising Connections (you probably didn't know these)
- `Publish flow` --references--> `FeedRepo`  [INFERRED]
  docs/INGESTION.md → app/src/data/feedRepo.ts
- `Contracts (do not change without the orchestrator)` --references--> `Repo`  [INFERRED]
  docs/ARCHITECTURE.md → app/src/data/repo.ts
- `Wave 8 (Início, mapa responsivo, duas localizações, Plano Casas Noturnas)` --references--> `EventStatus`  [INFERRED]
  docs/ARCHITECTURE.md → app/src/domain/types.ts
- `Task 5: Repos (seed, feed, Supabase) with parity` --references--> `FeedRepo`  [INFERRED]
  docs/superpowers/plans/2026-10-29-vibe-access-filters.md → app/src/data/feedRepo.ts
- `Error handling` --references--> `feedRepo()`  [INFERRED]
  docs/superpowers/specs/2026-10-29-vibe-access-filters-design.md → app/src/data/feedStatus.ts

## Import Cycles
- 2-file cycle: `app/src/data/sync/support.ts -> app/src/state/support.ts -> app/src/data/sync/support.ts`
- 2-file cycle: `app/src/data/sync/live.ts -> app/src/state/live.ts -> app/src/data/sync/live.ts`
- 2-file cycle: `app/src/data/sync/favorites.ts -> app/src/state/favorites.ts -> app/src/data/sync/favorites.ts`
- 2-file cycle: `app/src/data/sync/follows.ts -> app/src/state/follows.ts -> app/src/data/sync/follows.ts`
- 2-file cycle: `app/src/data/sync/reviews.ts -> app/src/state/reviews.ts -> app/src/data/sync/reviews.ts`
- 2-file cycle: `app/src/data/sync/checkins.ts -> app/src/state/checkins.ts -> app/src/data/sync/checkins.ts`

## Communities (126 total, 13 thin omitted)

### Community 0 - "ui/index.ts"
Cohesion: 0.04
Nodes (97): styles, DOTS, styles, TopicRowProps, styles, BENEFITS, styles, FAIL_MESSAGES (+89 more)

### Community 1 - "useBreakpoint"
Cohesion: 0.06
Nodes (78): Screen(), Screen(), Screen(), Screen(), useArtist(), useVenue(), formatBRLShort(), formatEventDate() (+70 more)

### Community 2 - "react"
Cohesion: 0.05
Nodes (68): Mapa(), LargeMode, MapaScreen(), styles, MapSheetStore, useMapSheet, styles, VenuePanel() (+60 more)

### Community 3 - "Text"
Cohesion: 0.07
Nodes (69): Screen(), Screen(), Screen(), Screen(), Screen(), Screen(), SearchBase, useEvent() (+61 more)

### Community 4 - "Cover.tsx"
Cohesion: 0.06
Nodes (62): COVER_PALETTE_IDS, COVER_TEMPLATE_IDS, coverFor(), CoverInput, CoverTemplateId, GENRE_TEMPLATES, hashString(), parseCoverKey() (+54 more)

### Community 5 - "harness.ts"
Cohesion: 0.05
Nodes (50): Task 3: Migration 0009 (columns, CHECKs, search_events v3), arr(), b(), datasetToSql(), n(), q(), base, [c1, c2, c3] (+42 more)

### Community 6 - "isRemote"
Cohesion: 0.09
Nodes (49): posterUrl(), ensureUserId(), getSupabase(), isRemote(), settle(), Call, flush(), Handler (+41 more)

### Community 7 - "acompanhar/__tests__/screens.test.tsx"
Cohesion: 0.05
Nodes (41): Screen(), MINI_NOW, miniDataset, setRepo(), Call, fakeSupabase(), Reply, TicketRow (+33 more)

### Community 8 - "PressableScale"
Cohesion: 0.08
Nodes (43): Salvos(), COVER_VARIANT_IDS, ArtistPicker(), styles, useDebounced(), groupSaved(), SalvosScreen(), styles (+35 more)

### Community 9 - "NovaFestaScreen.tsx"
Cohesion: 0.09
Nodes (49): POSTER_MAX_BYTES, CasasErrorCode, formatCnpj(), isValidCnpj(), onlyDigits(), partyMonthLabel(), ProposedVenue, CompanyErrors (+41 more)

### Community 10 - "Icon"
Cohesion: 0.10
Nodes (42): Screen(), Screen(), Screen(), Screen(), icon(), TabLayout(), AjudaScreen(), FaqRow() (+34 more)

### Community 11 - "DadosCadastraisScreen.tsx"
Cohesion: 0.10
Nodes (42): Screen(), deleteAddress(), useAddress(), useSaveAddress(), AddressFormProps, CepState, styles, Caption() (+34 more)

### Community 12 - "PerfilView.tsx"
Cohesion: 0.10
Nodes (39): Screen(), Screen(), relativeTimePt(), useGenres(), AreaSheet(), useOriginChip(), explainProfile(), useResetRecommendations() (+31 more)

### Community 13 - "data/casas.ts"
Cohesion: 0.09
Nodes (49): cancelEventSubmission(), CASA_MARE, CasasDemoState, CasasResult, claimVenue(), codeOf(), DemoAccount, demoAccount() (+41 more)

### Community 14 - "domain/types.ts"
Cohesion: 0.10
Nodes (25): Repo, compareItems(), normalizeText(), sortPriceKey(), base, ids(), repo, mapGenre() (+17 more)

### Community 15 - "state/demo.ts"
Cohesion: 0.10
Nodes (37): fromRow(), Checkin, ExportAccount, NOW, addCheckin(), CheckinsStore, hasCheckin(), useCheckins (+29 more)

### Community 16 - "domain/filters.ts"
Cohesion: 0.08
Nodes (37): AccessTag, ORDER, Tagged, tagLabel(), NOW, countActiveFilters(), DATE_RANGES, FilterState (+29 more)

### Community 17 - "sync.remote.test.ts"
Cohesion: 0.16
Nodes (32): mergeCheckins(), pullCheckins(), pushCheckin(), setUnsynced(), Catalog, defaultCatalog, FavKind, FavState (+24 more)

### Community 18 - "QuandoSheet.tsx"
Cohesion: 0.13
Nodes (38): addMonths(), compareMonths(), dateFilterLabel(), dateHeadline(), dayAndMonth(), DayCell, fields(), longDayLabel() (+30 more)

### Community 19 - "useFilters"
Cohesion: 0.11
Nodes (22): defaultFilters, mockBack, mockPush, mockReplace, clock, DatePill(), FilterButton(), GenreChips() (+14 more)

### Community 20 - "ContaScreen.tsx"
Cohesion: 0.09
Nodes (32): Screen(), @supabase/supabase-js@^2.118.0, deleteAccountRemote(), DISPLAY_NAME_MAX, displayNameKey, fetchDisplayName(), normalizeDisplayName(), saveDisplayName() (+24 more)

### Community 21 - "seed-data.ts"
Cohesion: 0.08
Nodes (36): Task 4: Seed tags, SQL oracle and fixtures, computeCases(), FIXED_NOW_ISO, FIXTURES, json(), main(), ROOT, SearchCase (+28 more)

### Community 22 - "with"
Cohesion: 0.05
Nodes (39): concurrency, cancel-in-progress, group, run, SYMPLA_TOKENS_JSON, defaults, runs-on, steps (+31 more)

### Community 23 - "VincularScreen.tsx"
Cohesion: 0.09
Nodes (30): Screen(), Screen(), Screen(), useAccountEmail(), EmpresaScreen(), proposedAddress(), Caption(), CheckLine() (+22 more)

### Community 24 - "app/_layout.tsx"
Cohesion: 0.10
Nodes (28): ErrorBoundary(), RootLayout(), unstable_settings, useRemoteSync(), mockPush, mockReplace, clearCrash(), CrashRecord (+20 more)

### Community 25 - "ExplorarScreen.tsx"
Cohesion: 0.12
Nodes (31): Screen(), useSearchEvents(), minuteNow(), Body(), ExplorarScreen(), openBusca(), SearchAllRow(), styles (+23 more)

### Community 26 - "engage.ts"
Cohesion: 0.12
Nodes (34): fetchLiveSummary(), isLocalId(), liveSummaryKey(), mapSummaryRow(), REPORT_PUSH_WINDOW_MS, setUnsynced(), SummaryRow, toRow() (+26 more)

### Community 27 - "normalize.ts"
Cohesion: 0.10
Nodes (34): VenueStatus, cand(), artistId(), eventId(), GENRES, ORDER, slugify(), sortGenres() (+26 more)

### Community 28 - "pipeline.test.ts"
Cohesion: 0.11
Nodes (28): addLink(), canonicalUrl(), linkSourceId(), parseLinksFile(), venueId(), ctx, GOLDEN, previousFeed() (+20 more)

### Community 29 - "location/index.ts"
Cohesion: 0.15
Nodes (29): areaToLocation(), geocodeAddress(), GeocodeResult, FALLBACK_LABEL, isInPilotArea(), OUTSIDE_PILOT_MESSAGE, PILOT_RADIUS_KM, isWatchedTab() (+21 more)

### Community 30 - "0005_engage.sql"
Cohesion: 0.11
Nodes (30): public.favorites, checkins_event_idx, event_follows_event_idx, event_reports_event_created_idx, event_reports_throttle_ins, public.can_vote_review(), public.checkins, public.event_follows (+22 more)

### Community 31 - "feedRepo.ts"
Cohesion: 0.10
Nodes (29): defaultStorage(), EVENT_STATUS, FEED_CACHE_KEY, FEED_MAX_BAD_RATIO, FEED_REFRESH_MS, FeedCache, FeedRepoOptions, FeedStatus (+21 more)

### Community 32 - "recommend.ts"
Cohesion: 0.10
Nodes (28): formatDistance(), spParts(), clamp01(), compare(), confidenceOf(), diversify(), genreLabel(), hourLabel() (+20 more)

### Community 33 - "pipeline.ts"
Cohesion: 0.12
Nodes (28): ReportingAdapter, NeedsReview, main(), parseArgs(), runOptions(), Paths, resolvePaths(), ROOT (+20 more)

### Community 34 - "sync/community.ts"
Cohesion: 0.12
Nodes (31): author(), CommentFeedRow, DEFAULT_REPORT_REASON, EMPTY_PAGE, HandleResult, mapCommentRow(), mapThreadRow(), Profile (+23 more)

### Community 35 - "expo"
Cohesion: 0.06
Nodes (33): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, package, predictiveBackGestureEnabled, projectId (+25 more)

### Community 36 - "0010_community.sql"
Cohesion: 0.13
Nodes (30): public.profiles, comment_votes_count, comments_parent_check, comments_parent_idx, comments_require_handle, comments_thread_idx, community_reports_hide, community_reports_user_comment_uq (+22 more)

### Community 37 - "acompanhar/logic.ts"
Cohesion: 0.09
Nodes (27): formatBRL(), ALERT_COPY, buildTimeline(), CHANGE_KIND_LABEL, countdownFor(), CountdownState, DEFAULT_DURATION_MS, DEMO_VENUE_SLUG (+19 more)

### Community 38 - "AssinaturaScreen.tsx"
Cohesion: 0.15
Nodes (26): Screen(), Screen(), casasKeys, formatPlanPrice(), AssinaturaScreen(), Confirmation(), isLive(), Loading() (+18 more)

### Community 39 - "LocalView.tsx"
Cohesion: 0.10
Nodes (21): Screen(), Screen(), useAreas(), AreaSheet(), Props, DEVICE_LOCATION_LABEL, DeviceLocationResult, LOCATION_MESSAGES (+13 more)

### Community 40 - "public.events"
Cohesion: 0.14
Nodes (26): event_artists_artist_idx, event_artists_order_idx, event_genres_genre_idx, events_published_starts_idx, events_starts_at_idx, events_venue_id_idx, public.artists, public.event_artists (+18 more)

### Community 41 - "MeusEventosScreen.tsx"
Cohesion: 0.13
Nodes (22): Screen(), Review, base, DEMO_REVIEWS, DEMO_VENUE_SLUG, byDateDesc(), MeusTab, REVIEW_STATUS_LABEL (+14 more)

### Community 42 - "SeedRepo"
Cohesion: 0.13
Nodes (7): FeedRepo, createRepo(), cases, dataset, repo, SeedRepo, SeedDataset

### Community 43 - "domain/community.ts"
Cohesion: 0.09
Nodes (25): ThreadFeedRow, Author, COMMENT_MAX, defaultSort(), effectiveHelpful(), Filterable, HANDLE_RE, Keyset (+17 more)

### Community 44 - "FiltrosScreen.tsx"
Cohesion: 0.12
Nodes (19): Screen(), RadiusKm, RawUrlParams, FiltrosScreen(), Footer(), styles, useLiveTotal(), viewLabel() (+11 more)

### Community 45 - "app-ci.yml"
Cohesion: 0.07
Nodes (27): defaults, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, run (+19 more)

### Community 46 - "EventoConversaScreen.tsx"
Cohesion: 0.13
Nodes (21): Screen(), CommunitySort, EventoConversaScreen(), SORTS, styles, FeedEmpty(), FeedFooter(), FeedLoading() (+13 more)

### Community 47 - "auth.ts"
Cohesion: 0.14
Nodes (21): Screen(), authAvailable(), AuthMode, AuthResult, CodeRequest, confirmEmailCode(), friendly(), isValidCode() (+13 more)

### Community 48 - "FeedScreen.tsx"
Cohesion: 0.21
Nodes (17): Screen(), DEFAULT_UF, isPilotUf(), isUf(), PILOT_UFS, Region, REGIONS, ufName() (+9 more)

### Community 49 - "capture-screens.mjs"
Cohesion: 0.07
Nodes (15): artist, { chromium }, demo, future, NOW, only, require, seed (+7 more)

### Community 50 - "domain/casas.ts"
Cohesion: 0.13
Nodes (25): AccountRow, demoUsed(), demoView(), ACCOUNT_STATUS_LABEL, addMonthKey(), CASAS_ERROR_MESSAGES, ClaimVenueInput, CODES (+17 more)

### Community 51 - "0015_venue_accounts.sql"
Cohesion: 0.13
Nodes (19): events_venue_account_idx, public.billing_events, public.blocks_account_deletion(), public.cancel_event_submission(), public.claim_venue(), public.is_venue_member(), public.my_venue_accounts(), public.plans (+11 more)

### Community 52 - "BuscaScreen.tsx"
Cohesion: 0.15
Nodes (20): Screen(), useArtistSearch(), RADIUS_OPTIONS, BuscaScreen(), Recents(), Section(), styles, useDebounced() (+12 more)

### Community 53 - "state/follows.ts"
Cohesion: 0.17
Nodes (23): FollowRow, AlertChannel, AlertKind, EventChange, EventFollow, addChanges(), ALERT_KINDS, emptyFollows (+15 more)

### Community 54 - "location.ts"
Cohesion: 0.15
Nodes (23): DeviceFix, FixResult, LocationPermission, LocationSource, ActiveOrigin, asFix(), asPoint(), CoreState (+15 more)

### Community 55 - "manual.ts"
Cohesion: 0.17
Nodes (23): RFC-4180, buildHeaderMap(), CSV_COLUMNS, csvToRecords(), isYes(), MANUAL_SOURCE, ManualRecord, parseCsv() (+15 more)

### Community 56 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, expo-constants@~58.0.13, expo-linking@~58.0.15, expo-location@~58.0.20, expo-router@~58.0.28, expo-symbols@~58.0.4, expo-web-browser@~58.0.7, @gorhom/bottom-sheet@^5.2.14 (+17 more)

### Community 57 - "smoke"
Cohesion: 0.08
Nodes (24): run, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_SUPABASE_URL, jobs, smoke, name, on, schedule (+16 more)

### Community 58 - "link.ts"
Cohesion: 0.16
Nodes (23): addressText(), asArray(), collectJsonLd(), findEvent(), fromFallback(), fromJsonLd(), isEventType(), isObj() (+15 more)

### Community 59 - "useTasteProfile.ts"
Cohesion: 0.14
Nodes (21): queryKeys, buildProfile(), lastN(), median(), MIN_GOOD_RATING, PROFILE_CAP, PROFILE_STALE_MS, useRecordGenreFilters() (+13 more)

### Community 60 - "VenueMap.tsx"
Cohesion: 0.14
Nodes (21): DEFAULT_ZOOM, FONT_BOLD, FONT_REGULAR, GLYPHS_URL, MAX_ZOOM, MIN_ZOOM, PILOT_BOUNDS, TILE_SOURCE_URL (+13 more)

### Community 61 - "search.test.ts"
Cohesion: 0.15
Nodes (20): ACCESS_TAGS, cleanTags(), effectiveTags(), isAccessTag(), matchesTags(), File structure, Task 1: Tag domain module, Task 6: Filtros UI section (+12 more)

### Community 62 - "EventItem"
Cohesion: 0.17
Nodes (20): EventItem, Venue, ShareSheetProps, applyLifecycle(), dedupeBySourceId(), endOf(), isStale(), LifecycleInput (+12 more)

### Community 63 - "ingest/package.json"
Cohesion: 0.10
Nodes (22): dependencies, node-html-parser@^7.1.0, description, devDependencies, tsx@^4.20.0, @types/node@^22.20.5, typescript@^5.9.0, tsx (+14 more)

### Community 64 - "comunidade/hooks.ts"
Cohesion: 0.15
Nodes (19): RemoteComment, RemoteThread, Comment, Thread, topHelpful(), anon, DEMO_COMMENTS, DEMO_THREADS (+11 more)

### Community 65 - "Event ingestion (Espírito Santo)"
Cohesion: 0.09
Nodes (20): Core pipeline: curated submissions and approval flow (`ingest/`, agent D), Cutover from the fictional seed to real data, Event ingestion (Espírito Santo), Legal gate for tier 3 (crawler), LGPD, takedown, retention, Politeness, Principles, Publish flow (+12 more)

### Community 66 - "app/package.json"
Cohesion: 0.10
Nodes (20): expo@~58.0.21, expo-font@~58.0.9, expo-image@~58.0.18, expo-splash-screen@~58.0.12, expo-status-bar@~58.0.4, jest@~30.5.2, @maplibre/maplibre-react-native@^11.5.0, @shopify/flash-list@2.3.2 (+12 more)

### Community 67 - "SupabaseRepo"
Cohesion: 0.19
Nodes (10): mapArtist(), mapEvent(), mapSearchRow(), mapVenue(), num(), pick(), RepoError, SupabaseRepo (+2 more)

### Community 68 - "state/community.ts"
Cohesion: 0.21
Nodes (17): isServerId(), pushComment(), pushCommentVote(), pushCommunityReport(), pushHandle(), pushThread(), writer(), isDuplicate() (+9 more)

### Community 69 - "billing-checkout/handler.ts"
Cohesion: 0.21
Nodes (10): billingCheckout(), CheckoutDeps, bearer(), json(), OwnedAccount, readAccountId(), StripeClient, SubscriptionInfo (+2 more)

### Community 70 - "http.ts"
Cohesion: 0.19
Nodes (7): createNominatimGeocoder(), CacheEntry, PageResult, parseRobots(), PoliteClient, RobotsRules, Geocoder

### Community 71 - "billing-webhook/handler.ts"
Cohesion: 0.18
Nodes (13): billingWebhook(), done(), enc, HANDLED_EVENTS, hmacHex(), idOf(), SIGNATURE_TOLERANCE_S, signStripePayload() (+5 more)

### Community 72 - "billing-checkout/index.ts"
Cohesion: 0.11
Nodes (8): admin, config, stripe, createStripe(), formEncode(), StripeError, admin, stripe

### Community 73 - "address.ts"
Cohesion: 0.18
Nodes (14): addressKey, AddressRow, AddressValidation, DeleteAddressResult, fetchAddress(), fromRow(), saveAddress(), SaveAddressResult (+6 more)

### Community 74 - "VenueMapSchematic.tsx"
Cohesion: 0.23
Nodes (13): BOUNDS, NEIGHBORHOODS, project(), circleBounds(), circleFeature(), circleRing(), KM_PER_DEG_LAT, KM_PER_DEG_LNG (+5 more)

### Community 75 - "PainelScreen.tsx"
Cohesion: 0.19
Nodes (13): Screen(), Screen(), casasErrorMessage(), FESTA_BADGE, SUBSCRIPTION_BADGE, NovaFestaScreen(), PosterStep(), accountBlocker() (+5 more)

### Community 76 - "billing-webhook/index.ts"
Cohesion: 0.13
Nodes (3): admin, stripe, admin

### Community 77 - "feedStatus.ts"
Cohesion: 0.22
Nodes (11): FeedSource, attached, feedRepo(), OFF, offSnapshot(), Probe(), { renderToString }, useFeedInvalidation() (+3 more)

### Community 78 - "venueMap.native.test.tsx"
Cohesion: 0.21
Nodes (11): ATTRIBUTION, groupByScore(), groupByVenue(), pinLabel(), RECOMMENDED_PINS, base, center, itemsFor() (+3 more)

### Community 79 - "adapters/index.ts"
Cohesion: 0.24
Nodes (12): AdapterFactoryOptions, buildAdapters(), loadOptional(), OPTIONAL_MODULES, createLinkAdapter(), LinkAdapter, createManualAdapter(), ManualAdapter (+4 more)

### Community 80 - "deleteAccount"
Cohesion: 0.24
Nodes (5): BUCKETS, CORS, deleteAccount(), Deps, json()

### Community 81 - "Sheet"
Cohesion: 0.33
Nodes (8): Sheet(), SheetHeader(), styles, SheetNative(), styles, SheetProps, SheetWeb(), styles

### Community 82 - "billing.test.ts"
Cohesion: 0.19
Nodes (7): Call, checkoutDeps(), mockFetch(), NOW, webhookDeps(), U(), fake()

### Community 83 - "venue_accounts.test.ts"
Cohesion: 0.22
Nodes (10): as(), asService(), at(), clearEvents(), day(), ds, payload(), quota() (+2 more)

### Community 84 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, @electric-sql/pglite@^0.5.11, react-test-renderer@^19.3.0, @testing-library/react-native@^14.1.0, tsx@^4.23.15, @types/react@~19.3.0, typescript@~6.0.3, tsx (+4 more)

### Community 85 - "VenueMap.web.tsx"
Cohesion: 0.27
Nodes (10): createPinElement(), createUserElement(), EMPTY_FC, fitPadding(), isOffline(), SimplifiedMap(), styles, VenueMap() (+2 more)

### Community 86 - "Design System: Qual a boa?"
Cohesion: 0.17
Nodes (11): 10. UX Rules, 11. Anti-Patterns (Banned), 1. Visual Theme & Atmosphere, 2. Color Palette & Roles, 3. Typography, 4. Space, Shape, Targets, 5. Components (`app/src/ui`), 6. Layout Principles (+3 more)

### Community 87 - "Screens: Qual a boa?"
Cohesion: 0.17
Nodes (11): 1. Entrada, 2. Descobrir, 3. Evento, 4. Salvar e acompanhar, 5. Avaliar, 6. Perfil e conta, 7. Ajuda e suporte, 8. Sistema (+3 more)

### Community 88 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, module, moduleResolution, noEmit, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck, strict (+3 more)

### Community 89 - "0007_uploads.sql"
Cohesion: 0.32
Nodes (11): public.owns_review(), public.review_photos, public.review_photos_limit(), public.review_photos_remoderate(), public.support_attachments, public.support_attachments_limit(), review_photos_limit_ins, review_photos_remoderate_ins (+3 more)

### Community 90 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, android, ios, lint, seed, start, test, test:remote (+3 more)

### Community 91 - "feed.remote.test.tsx"
Cohesion: 0.22
Nodes (9): use(), fakeClient(), use(), use(), COMMUNITY_PAGE_SIZE, rowAt(), rows(), use() (+1 more)

### Community 92 - "Comunidade: event-scoped forum with "Mais útil" highlight"
Cohesion: 0.18
Nodes (10): Accessibility and states, Comunidade: event-scoped forum with "Mais útil" highlight, Data (migrations 0010-0012, applied to the remote on 2026-10-31), Decisions, Feed sizing and comfort, Helpful highlight, Open items, Problem (+2 more)

### Community 93 - "@tanstack/react-query"
Cohesion: 0.24
Nodes (7): Screen(), useComments(), renderThread(), mockEvent, wrap(), ThreadScreen(), @tanstack/react-query

### Community 94 - "AppProviders.tsx"
Cohesion: 0.24
Nodes (8): react-native-gesture-handler@~3.3.0, react-native-safe-area-context@~5.10.1, AppProviders(), createAppQueryClient(), styles, ThemeProvider(), react-native-gesture-handler, react-native-safe-area-context

### Community 95 - "getRepo"
Cohesion: 0.29
Nodes (8): getRepo(), NowLike, SavedEvent, SavedGroups, Resolved, useSavedArtists(), useSavedEvents(), useSavedVenues()

### Community 96 - "feed.test.tsx"
Cohesion: 0.22
Nodes (6): ThreadQuery, client(), Collect(), mockEnv, Probe(), wrap()

### Community 97 - "draft.ts"
Cohesion: 0.24
Nodes (8): ReviewTopic, ReviewSort, ReviewStats, Draft, empty, Score, Seed, ReviewInput

### Community 98 - "vercel.json"
Cohesion: 0.20
Nodes (9): build, env, buildCommand, EXPO_PUBLIC_APP_ENV, framework, installCommand, outputDirectory, rewrites (+1 more)

### Community 99 - "Architecture and ownership"
Cohesion: 0.20
Nodes (9): Architecture and ownership, Commands (run in `app/`), Contracts (do not change without the orchestrator), File ownership (parallel agents must not edit outside their paths), Layout, Rules for every agent, Visual spec, Wave 3 (engagement) (+1 more)

### Community 100 - "shared.ts"
Cohesion: 0.24
Nodes (9): CORS, FormValue, iso(), mapStripeStatus(), StripeSubscription, SubscriptionRow, subscriptionRow(), SubscriptionStatus (+1 more)

### Community 101 - "app/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, paths, strict, types, exclude, extends, include, expo/tsconfig.base

### Community 102 - "fonts.ts"
Cohesion: 0.25
Nodes (7): @expo-google-fonts/geist@^0.4.2, @expo-google-fonts/geist-mono@^0.4.3, @expo-google-fonts/outfit@^0.4.3, fontMap, @expo-google-fonts/geist, @expo-google-fonts/geist-mono, @expo-google-fonts/outfit

### Community 103 - "eslint.config.js"
Cohesion: 0.29
Nodes (6): { defineConfig }, expoConfig, eslint-config-expo@~58.0.4, eslint@^9.39.5, eslint, eslint-config-expo

### Community 104 - "mapa.test.tsx"
Cohesion: 0.33
Nodes (5): itemsFor(), mockMapProps, mockNavigate, mockPush, venueOf()

### Community 105 - "Design audit — mockups (2026-10-22)"
Cohesion: 0.29
Nodes (6): Brand sprint additions (Q?), Contrast (computed), Design audit — mockups (2026-10-22), Findings and status, Open gates before any launch, UX sprint additions (tracking, feedback, reviews, support)

### Community 106 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 107 - "ResultBar.tsx"
Cohesion: 0.40
Nodes (5): SortKey, countLabel(), ResultBar(), SORTS, styles

### Community 108 - "jest"
Cohesion: 0.40
Nodes (5): jest, moduleNameMapper, preset, setupFilesAfterEnv, testPathIgnorePatterns

### Community 109 - "VenuePin"
Cohesion: 0.50
Nodes (4): VenueMapProps, VenuePin, VenuePanelProps, Wave 6 (free map, location, recommendations)

### Community 110 - "Qual a boa?"
Cohesion: 0.40
Nodes (4): Notes, Qual a boa?, Run, What exists

### Community 111 - "supabase/"
Cohesion: 0.40
Nodes (4): Commands (run in `app/`), Remote Supabase project, search_events contract (mirror this in SeedRepo), supabase/

### Community 112 - "Vitória nightlife research (for seed data and design placeholders)"
Cohesion: 0.50
Nodes (3): Product implications, Sources, Vitória nightlife research (for seed data and design placeholders)

## Knowledge Gaps
- **4 isolated node(s):** `expo/tsconfig.base`, `RFC-4180`, `RFC-4122`, `RFC-4122`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 959 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-native` connect `ui/index.ts` to `useBreakpoint`, `react`, `Text`, `Cover.tsx`, `PressableScale`, `NovaFestaScreen.tsx`, `Icon`, `DadosCadastraisScreen.tsx`, `PerfilView.tsx`, `domain/filters.ts`, `QuandoSheet.tsx`, `useFilters`, `ContaScreen.tsx`, `VincularScreen.tsx`, `app/_layout.tsx`, `ExplorarScreen.tsx`, `engage.ts`, `location/index.ts`, `sync/community.ts`, `AssinaturaScreen.tsx`, `LocalView.tsx`, `MeusEventosScreen.tsx`, `FiltrosScreen.tsx`, `EventoConversaScreen.tsx`, `FeedScreen.tsx`, `BuscaScreen.tsx`, `dependencies`, `VenueMap.tsx`, `app/package.json`, `VenueMapSchematic.tsx`, `PainelScreen.tsx`, `venueMap.native.test.tsx`, `Sheet`, `VenueMap.web.tsx`, `AppProviders.tsx`, `feed.test.tsx`, `mapa.test.tsx`, `ResultBar.tsx`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base`, `RFC-4180`, `RFC-4122` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04176105584556289 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `ui/index.ts`, `useBreakpoint`, `Text`, `Cover.tsx`, `acompanhar/__tests__/screens.test.tsx`, `PressableScale`, `NovaFestaScreen.tsx`, `Icon`, `DadosCadastraisScreen.tsx`, `PerfilView.tsx`, `state/demo.ts`, `sync.remote.test.ts`, `QuandoSheet.tsx`, `useFilters`, `ContaScreen.tsx`, `VincularScreen.tsx`, `app/_layout.tsx`, `ExplorarScreen.tsx`, `engage.ts`, `location/index.ts`, `sync/community.ts`, `AssinaturaScreen.tsx`, `LocalView.tsx`, `MeusEventosScreen.tsx`, `FiltrosScreen.tsx`, `EventoConversaScreen.tsx`, `auth.ts`, `FeedScreen.tsx`, `BuscaScreen.tsx`, `dependencies`, `useTasteProfile.ts`, `VenueMap.tsx`, `comunidade/hooks.ts`, `app/package.json`, `PainelScreen.tsx`, `feedStatus.ts`, `Sheet`, `VenueMap.web.tsx`, `AppProviders.tsx`, `mapa.test.tsx`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `useBreakpoint` be split into smaller, more focused modules?**
  _Cohesion score 0.06198019801980198 - nodes in this community are weakly interconnected._
- **Why does `Text()` connect `Text` to `ui/index.ts`, `useBreakpoint`, `react`, `acompanhar/__tests__/screens.test.tsx`, `PressableScale`, `NovaFestaScreen.tsx`, `Icon`, `DadosCadastraisScreen.tsx`, `PerfilView.tsx`, `QuandoSheet.tsx`, `useFilters`, `ContaScreen.tsx`, `VincularScreen.tsx`, `ExplorarScreen.tsx`, `engage.ts`, `AssinaturaScreen.tsx`, `LocalView.tsx`, `domain/community.ts`, `FiltrosScreen.tsx`, `EventoConversaScreen.tsx`, `auth.ts`, `FeedScreen.tsx`, `BuscaScreen.tsx`, `VenueMap.tsx`, `VenueMapSchematic.tsx`, `PainelScreen.tsx`, `Sheet`, `VenueMap.web.tsx`, `@tanstack/react-query`, `ResultBar.tsx`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.05306217858812529 - nodes in this community are weakly interconnected._