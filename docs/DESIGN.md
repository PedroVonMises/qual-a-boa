# Design System: Qual a boa?

Mobile-first (iOS, Android, responsive web). Pilot market: Vitória, ES, Brazil. Language: pt-BR. Dark-first, light supported.
Taste dials: Density 5 (Daily App Balanced), Variance 6 (Offset Asymmetric), Motion 6 (Fluid, spring-driven).

**This document describes the system as built** (2026-10-30). Values come from `app/src/theme/tokens.ts` and `app/src/ui/**`; when this file and the code disagree, fix one of them in the same change. The visual reference is `docs/SCREENS.md` (screenshots of every implemented screen in UX-flow order) and the published inventory: https://claude.ai/artifact/HyRSm12LNa6nVz7qf8fS6h. The HTML mockups in `docs/design-canvas/` are the earlier exploration and are kept for history only.

## 1. Visual Theme & Atmosphere
A late-evening interface: deep warm-charcoal surfaces, one hot punk-pink accent (Riot Pink), and illustrated covers doing the heavy lifting. It should feel like the sidewalk outside a good club at 11pm: lit, a little loud, but easy to read. Covers are full-bleed and rounded; typography is confident and tightly tracked; chrome stays quiet so the posters and artists stand out. Browse patterns borrow from delivery apps (shelves, chips, sticky filters), but the tone is local and playful, not corporate.

## 2. Color Palette & Roles
Dark theme (default, `darkColors`):
| Token | Name | Hex | Role |
|---|---|---|---|
| `background` | Night Charcoal | `#121110` | App background (never pure black) |
| `surface` | Soot Surface | `#1B1A18` | Cards, sheets, tab bar |
| `surfaceAlt` | Raised Ash | `#262421` | Idle chips, inputs, pressed surfaces |
| `border` | Hairline | `rgba(255,255,255,0.08)` | 1px dividers and card borders |
| `text` | Bone | `#F4F1EC` | Primary text (16.7:1 on Night) |
| `textMuted` | Dusk | `#A8A29A` | Secondary text, metadata (7.5:1) |
| `accent` | Riot Pink | `#FF4F81` | The single accent: primary CTA, active chip, selected tab, focus ring, "hoje" badge (6.0:1) |
| `onAccent` | Riot Ink | `#1A0A06` | Text on Riot Pink fills (6.1:1) |
| `success` | Signal Green | `#4FB286` | "Grátis", open now, verified |
| `danger` | Alert Red | `#E0524D` | Errors only, never a button fill |
| `dangerText` | Alert Red Text | `#FF8A86` | Error text on dark |

Brand depth (brand art, splash, posters): Wine `#3A1220`, Burgundy `#6B1D3A`, Blush `#FFC2D1`, Amber `#F2A65A`. Amber is reserved for light (the bulb core, glows in brand art, star ratings).

Light theme (`lightColors`): Paper `#F7F4EF` background, White `#FFFFFF` surface, `#ECE7DF` surfaceAlt, `rgba(28,26,23,0.12)` border, Ink `#1C1A17` text, Stone `#6B655D` muted, Riot Pink on light `#D01B58` accent (4.8:1 on Paper) with White on it, success `#2E7D5B`, danger `#B3261E`.

Rules: one accent; no purple/blue neon, no gradient text, no glow shadows in the UI. Image scrims are neutral (black 0 to 60%) for legibility only. Never Bone/White text on Riot Pink (2.8:1); always Riot Ink. Pink on Burgundy (3.6:1) only for graphics and 24px+ text. Contrast pairs are enforced by `app/src/theme/tokens.test.ts`.

**Cover art palettes (exception):** UI chrome stays Riot Pink and neutral, but the illustrated covers (`app/src/ui/art/palettes.ts`) may be colorful: 12 duo/trio palettes of flat shapes with at most two-stop gradients. Art has no pure black or white, no glow, no filters, and its bottom stays calm enough for the neutral scrim and white title text. Venues with an identity (Bolt, A Selva, Gordinho, Pub 426, Fluente, Casa Caipora, Casa Maré) have their own art component; other events use a template (sol-mare, disco, raio, lua, vinil, guitarra, equalizador, galera, neon, drink, palmas…).

## 3. Typography
| Role | Family (token) | Use |
|---|---|---|
| Display | Outfit 700 (`display`), 600 (`displaySemi`) | Headings, tracking -1% to -2%, sentence case |
| Body | Geist 400/500/600 (`body`, `bodyMedium`, `bodySemi`) | Body and UI, line-height 1.5, max 65ch on web |
| Numbers | Geist Mono 500 (`mono`) | Prices, distances, times ("R$ 40", "1,2 km", "23h") |

Scale (`type`, size/line-height): caption 12/16, bodySm 14/20, body 16/24, title 20/26, headline 24/30, display 32/36, displayLg 44/46 (web >= 1024). Minimum body text is 14; 12 only for captions and tab labels. Support font scaling to 200% without clipping. Banned: Inter, Roboto-as-brand, generic serifs, all-caps paragraphs.

## 4. Space, Shape, Targets
- **Spacing (`space`, 4pt base):** xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32.
- **Radius (`radius`):** sm 12, md 16 (buttons, inputs, search, segmented), lg 24 (cards, posters), xl 28 (sheets), full (chips, tags, badges, icon buttons, switches).
- **Touch targets (`hit`):** 44 minimum everywhere, buttons 52, chips 44.
- **Breakpoints:** sm < 640 single column + bottom tabs; md 640-1023 two columns; lg >= 1024 left rail + multi-column grid and map/list split. Content max-width 1280. Screen gutters 16 (sm), 24 (md), 32 (lg).

## 5. Components (`app/src/ui`)
All states are visible in the dev gallery at `/dev/ui` (`Gallery.tsx`, dev builds only).
- **Button:** primary = Riot Pink fill + Riot Ink label; secondary = Raised Ash; ghost for tertiary. 52 tall, radius 16, optional leading icon, loading state, disabled at 40% opacity keeping the label.
- **IconButton:** 44×44 circle; variants plain, filled (Ash), accent (Pink).
- **Chip:** 44 tall, radius full, Raised Ash idle; selected = Pink fill + check icon; optional count; horizontal scroll rows.
- **Tag / Badge:** 28 tall, radius full. Tag = neutral text label (genres, vibe & acesso). Badge tones: accent ("Hoje · 21h"), success ("Grátis"), danger ("Esgotado", "Cancelado"), neutral ("Aberto agora"); always text, optional icon.
- **EventCard:** poster 264×240, radius 24, full-bleed cover, neutral bottom scrim, date badge top-left, save heart top-right (44 target), title + venue/distance + price in mono. Row variant: 72×72 cover (radius 14) left, text right, min height 88, divider below instead of a nested card.
- **Explorar lead grid (md+):** one lead card spanning 2×2 poster cells plus smaller posters, never three equal cards.
- **VenueRow / ArtistRow / ListRow:** list rows with divider; ArtistRow has a 40px circular avatar and an optional "já tocou" date in mono.
- **SearchBar:** 48 tall, Raised Ash, radius 16, placeholder plus accessible label.
- **SegmentedControl:** Ash track, radius 16, 2px inset, selected segment in Riot Pink.
- **Switch:** 52×32 track, 24 thumb, Pink when on, label always present.
- **Rating / ScoreBar:** star rating (Amber stars, 44+ targets), horizontal score bars per topic with the value in mono.
- **Sheet:** bottom sheet with radius 28 top corners (native via @gorhom/bottom-sheet, web via SheetWeb); right drawer 420 wide on web >= 1024. SheetHeader with title and close.
- **TabBar:** Explorar, Mapa, Comunidade, Salvos, Perfil. Bottom bar 64 + safe area; active = Pink icon + label + 3px top indicator. At >= 1024 it becomes a 240px left rail with the logo on top. Comunidade is about the user's **state**: a one-line explainer under the title and a state pill (pin + name + chevron, same shape as the Explorar pills) that opens "Seu estado", a sheet of all 27 states where only the pilot states (Espírito Santo) are selectable and the rest read "Em breve".
- **ScreenHeader:** back IconButton, centered title, optional right action.
- **Skeleton:** shimmer blocks at exact card size; no spinners.
- **EmptyState / ErrorState:** unlit bulb illustration, a specific headline and one next action ("Explorar eventos", "Aumente o raio para 10 km"); errors inline with retry.
- **Cover / Scrim:** illustrated cover art (see §2) and the neutral legibility scrim.
- **Logo / AnimatedLogo / Wordmark:** see §8.
- **Icon:** the app's own outline SVG set (`Icon.tsx`), 24px, stroke 1.75: search, pin, heart, bookmark, compass, map, user, chevrons, close, check, filter, share, send, paperclip, star, headset, clock, plus. No emoji as icons.
- **Filtros sections:** Gênero (multi chips), Vibe & acesso (Acessível, LGBTQIA+ friendly, Pet friendly, Opção vegana; AND match; Evento and Casa show the same labels as Tags), Região, Preço (stepper + "Grátis"), Distância (1/3/5/10/25 km), Data (opens Quando), Artista (searchable). Sticky footer "Limpar" + "Ver N eventos".

## 6. Layout Principles
- Use CSS grid on web; full height uses dvh equivalents and safe-area insets.
- No overlapping content: text sits on scrims only inside image cards, otherwise in its own zone.
- Status never by color alone (text chips, icons, check marks). No hover-only affordances.

## 7. Motion & Interaction (`motion`)
- Springs by default (stiffness 140, damping 18, mass 1); no linear easing. Press = scale 0.97 spring + light haptic on native.
- Lists and shelves mount with staggered fade + translateY (40ms steps, max 8 items). Implemented by `Reveal` (`ui/Reveal.tsx`) with a per-list `useRevealScope`, so a row never replays its entrance when recycled or revisited; later pages append quietly.
- Content that replaces a skeleton, and whole screens on mount, fade in (`ScreenFade`, opacity only). Text that changes in place, like the Explorar headline, settles in with `Swap`. Tabs cross-fade (`animation: 'fade'`); the native stack keeps its platform push animation (its `animation` option is iOS/Android only), so on web the screen fade is the transition.
- Perpetual micro-motion only for skeleton shimmer and the soft pulse of the "Agora" live badge.
- Animate transform/opacity only. Reduce Motion replaces springs with 120ms fades.
- Splash: the bulb tube and base draw on (700ms), the amber core flickers on (650ms), the wordmark follows (1350ms delay). With Reduce Motion it shows the lit logo.

## 8. Brand
- **Logo:** a light bulb rotated 45 degrees that reads as a "Q" (globe = ring, screw base = tail, amber core = light on). Files: `app/assets/brand/mark.svg`, `mark-mono.svg`, `app-icon.svg`, `mark-neon.svg`, `app-icon-wine.svg`. The earlier "Q?" exploration is archived in `app/assets/brand/alt-q/` and not used.
- **Colors:** ring and base Riot Pink, core Amber. On pink backgrounds use the mono mark in Riot Ink. Minimum size 16px; clear space equal to the core diameter.
- **Wordmark:** "Qual a boa?" with a capital Q, Outfit 700, tracking -2%.
- **Glow** only in brand art (neon mark, splash, sticker); the UI never glows. Tagline: "Acende a noite."

## 9. Copy Voice (pt-BR)
Casual, short, local: "Qual a boa hoje?" (the last word follows the chosen day: "amanhã", "depois de amanhã", "na sexta", "no fim de semana", "dia 14 de novembro"), "Perto de você", "Até R$ 40", "Já passaram por aqui", "Ver ingressos". Capixaba slang only where it reads naturally. No marketing clichés. Mandatory 18+ and "Beba com moderação. Se beber, não dirija." in onboarding and footer. Honest data labels ("Relatos de 14 pessoas, o último há 12 min"); response-time expectations before contact; inline field errors with the fix.

## 10. UX Rules
- Onboarding gate: age (18+) then location and optional styles; `SessionGuard` redirects until both are done.
- Nights run 06:00 to 05:59 ("Hoje", Quando sheet).
- The app never sells tickets: Ingressos shows price, quantity, meia-entrada and the exact host where the purchase ends.
- Demonstration content (reviews, live status, updates, support chat) exists only for Casa Maré and carries no mock tags (owner decision, Wave 7); the Terms disclose demonstration content during the pilot. Never invent reviews or status for other venues.
- Offline: floating banner above the tab bar; cached results stay on screen.
- Not built on purpose (needs contracts or setup): ticket tiers/lotes, Google/Apple sign-in, Instagram Stories share, the "Vai ou não vai?" poll, a time-of-night filter.

## 11. Anti-Patterns (Banned)
- Emojis as UI icons, Inter, pure black/white backgrounds, neon glows in the UI, purple/blue AI gradients.
- Three equal feature cards as a layout device, centered hero on md+.
- Nested cards inside cards, carousels without scroll affordance, hidden filter state.
- Placeholder names like "John Doe"/"Acme"; fake round stats; "Scroll to explore" text.
- Color as the only signal; touch targets under 44.
