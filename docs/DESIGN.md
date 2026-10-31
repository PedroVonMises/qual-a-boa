# Design System: Qual a boa?

Mobile-first (iOS, Android, responsive web). Pilot market: Vitória, ES, Brazil. Language: pt-BR. Dark-first, light supported.
Taste dials: Density 5 (Daily App Balanced), Variance 6 (Offset Asymmetric), Motion 6 (Fluid, spring-driven).

**This document describes the system as built** (2026-10-30). Values come from `app/src/theme/tokens.ts` and `app/src/ui/**`; when this file and the code disagree, fix one of them in the same change. The visual reference is `docs/SCREENS.md` (screenshots of every implemented screen in UX-flow order) and the published inventory: https://claude.ai/artifact/HyRSm12LNa6nVz7qf8fS6h. The HTML mockups in `docs/design-canvas/` are the earlier exploration and are kept for history only.

## 1. Visual Theme & Atmosphere
A late-evening interface: deep warm-charcoal surfaces, one hot punk-pink accent (Riot Pink), and illustrated covers doing the heavy lifting. It should feel like the sidewalk outside a good club at 11pm: lit, a little loud, but easy to read. Covers are full-bleed and rounded; typography is confident and tightly tracked; chrome stays quiet so the posters and artists stand out. Browse patterns borrow from delivery apps (shelves, chips, sticky filters), but the tone is local and playful, not corporate.

## 2. Color Palette & Roles
Dark theme (default):
- **Night Charcoal** (#121110) — App background (never pure black)
- **Soot Surface** (#1B1A18) — Cards, sheets, tab bar
- **Raised Ash** (#262421) — Chips (idle), inputs, pressed surfaces
- **Hairline** (rgba(255,255,255,0.08)) — 1px dividers and card borders
- **Bone Text** (#F4F1EC) — Primary text (contrast 16.7:1 on Night Charcoal)
- **Dusk Text** (#A8A29A) — Secondary text, metadata (contrast 7.5:1)
- **Riot Pink** (#FF4F81, 6.0:1 on Night Charcoal) — A hot, warm punk pink; the single accent: primary CTA, active chip, selected tab, focus ring, "hoje" badge
- **Riot Ink** (#1A0A06) — Text on Riot Pink fills (contrast 6.1:1)
- **Signal Green** (#4FB286) — "Grátis" / open-now status only
- **Alert Red** (#E0524D) — Errors only (kept distinct from Riot Pink by usage, never as a button fill)

Light theme: Paper (#F7F4EF) background, White (#FFFFFF) surface, Ink (#1C1A17) text, Stone (#6B655D) secondary, Riot Pink (#D01B58, 4.8:1 on Paper, for AA on light), same roles.
Rules: max one accent; no purple/blue neon, no gradient text, no glow shadows. Image scrims are neutral (black 0 to 60%) for legibility only.
**Cover art palettes (exception):** the UI chrome stays Riot Pink and neutral, but the illustrated event covers (`app/src/ui/art/palettes.ts`) may be colorful: 12 duo/trio palettes (hot pink + amber, teal + coral, tangerine + deep teal, lime + plum, sky + sunset, mint + berry...) of flat shapes with at most two-stop gradients. Art still has no pure black or white, no glow, no filters, and its bottom stays calm enough for the neutral scrim and white title text.

## 3. Typography Rules
- **Display / headings:** Outfit (600/700), tracking -1% to -2%, sentence case. Hierarchy by weight and color, not size alone.
- **Body / UI:** Geist (400/500/600), line-height 1.5, max 65ch on web.
- **Numbers (prices, distances, times):** Geist Mono (500), so "R$ 40", "1,2 km", "23h" align in lists.
- **Scale (sp/px):** 12 caption, 14 body-sm, 16 body, 20 title, 24 headline, 32 display (clamp to 44 on web >=1024).
- Minimum body 14. Support Dynamic Type / font scaling to 200% without clipping.
- Banned: Inter, Roboto-as-brand, generic serifs, all-caps paragraphs.

## 4. Component Stylings
- **Buttons:** Primary = Riot Pink fill, Riot Ink label, 52px tall, radius 16. Secondary = Raised Ash fill. Ghost for tertiary. Press = scale 0.97 spring + light haptic (native). Disabled at 40% opacity with label retained.
- **Chips (genre, date):** 40px tall, radius full, Raised Ash idle, Riot Pink fill when active, icon-free text, horizontal scroll with snap, edge fade.
- **Event card (shelf):** 280x360 poster card, radius 24, cover image full-bleed, neutral bottom scrim, title (Outfit 20), venue + distance (Dusk), price pill (Geist Mono). Save heart top-right (44px target).
- **Event card (list):** horizontal, 112px square cover left, text right, divider below instead of nested card.
- **Artist chip:** 40px circular photo + name; "já tocou aqui" variant adds date in mono.
- **Filter sheet:** bottom sheet (native) / right drawer (web >=1024). Sections: Gênero (multi chips), Preço (range slider + "Grátis" toggle), Distância (1/3/5/10/25 km stops), Data, Artista (searchable). Sticky footer: "Limpar" + "Ver N eventos" (Riot Pink).
- **Vibe & acesso:** Filtros section of four text chips (Acessível, LGBTQIA+ friendly, Pet friendly, Opção vegana); Evento and Casa show the same labels as text Tags below the genres. Match is AND. Tags on demo venues are demonstration data.
- **Search bar:** 48px, Raised Ash, radius 16, label via placeholder AND accessible label.
- **Skeletons:** shimmer blocks matching exact card dimensions; no spinners.
- **Empty states:** a composed poster-style illustration and a specific next action ("Aumente o raio para 10 km").
- **Errors:** inline with retry; offline banner keeps cached results visible.
- **Tab bar:** Explorar, Mapa, Comunidade, Salvos, Perfil; 64px + safe area; active = Riot Pink icon + label.

## 5. Layout Principles
- Grid: 4pt base; screen gutters 16 (sm), 24 (md), 32 (lg). Content max-width 1280 on web.
- Breakpoints: sm <640 single column + bottom tabs; md 640-1023 two-column grid; lg >=1024 left rail + 3-4 column grid, map/list split view.
- Home composition is asymmetric: the first shelf ("Hoje à noite") uses one large lead card + stacked smaller cards at md+, not three equal cards.
- Use CSS grid on web, never calc() hacks; full-height uses 100dvh equivalents and safe-area insets.
- No overlapping content: text sits on scrims only inside image cards, otherwise in its own zone.
- Status never by color alone (text chips, icons, check marks). No hover-only affordances.

## 7. Motion & Interaction (`motion`)
- Springs by default (stiffness 140, damping 18, mass 1); no linear easing. Press = scale 0.97 spring + light haptic on native.
- Lists and shelves mount with staggered fade + translateY (40ms steps, max 8 items).
- Perpetual micro-motion only for skeleton shimmer and the soft pulse of the "Agora" live badge.
- Animate transform/opacity only. Reduce Motion replaces springs with 120ms fades.
- Splash: the bulb tube and base draw on (700ms), the amber core flickers on (650ms), the wordmark follows (1350ms delay). With Reduce Motion it shows the lit logo.

## 8. Brand
- **Logo:** a light bulb rotated 45 degrees that reads as a "Q" (globe = ring, screw base = tail, amber core = light on). Files: `app/assets/brand/mark.svg`, `mark-mono.svg`, `app-icon.svg`, `mark-neon.svg`, `app-icon-wine.svg`. The earlier "Q?" exploration is archived in `app/assets/brand/alt-q/` and not used.
- **Colors:** ring and base Riot Pink, core Amber. On pink backgrounds use the mono mark in Riot Ink. Minimum size 16px; clear space equal to the core diameter.
- **Wordmark:** "Qual a boa?" with a capital Q, Outfit 700, tracking -2%.
- **Glow** only in brand art (neon mark, splash, sticker); the UI never glows. Tagline: "Acende a noite."

## 9. Copy Voice (pt-BR)
Casual, short, local: "Qual a boa hoje?", "Perto de você", "Até R$ 40", "Já passaram por aqui", "Ver ingressos". Capixaba slang only where it reads naturally. No marketing clichés. Mandatory 18+ and "Beba com moderação. Se beber, não dirija." in onboarding and footer. Honest data labels ("Relatos de 14 pessoas, o último há 12 min"); response-time expectations before contact; inline field errors with the fix.

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
