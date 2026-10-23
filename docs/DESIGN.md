# Design System: Qual a boa?

Mobile-first (iOS, Android, responsive web). Pilot market: Vitória, ES, Brazil. Language: pt-BR. Dark-first, light supported.
Taste dials: Density 5 (Daily App Balanced), Variance 6 (Offset Asymmetric), Motion 6 (Fluid, spring-driven).

## 1. Visual Theme & Atmosphere
A late-evening interface: deep warm-charcoal surfaces, one hot punk-pink accent (Riot Pink), and photography doing the heavy lifting. It should feel like the sidewalk outside a good club at 11pm: lit, a little loud, but easy to read. Event covers are full-bleed and rounded; typography is confident and tightly tracked; chrome stays quiet so the posters and artists stand out. Browse patterns borrow from delivery apps (shelves, chips, sticky filters), but the tone is local and playful, not corporate.

## 2. Color Palette & Roles
Dark theme (default):
- **Night Charcoal** (#121110) — App background (never pure black)
- **Soot Surface** (#1B1A18) — Cards, sheets, tab bar
- **Raised Ash** (#262421) — Chips (idle), inputs, pressed surfaces
- **Hairline** (rgba(255,255,255,0.08)) — 1px dividers and card borders
- **Bone Text** (#F4F1EC) — Primary text (contrast 16.7:1 on Night Charcoal)
- **Dusk Text** (#A8A29A) — Secondary text, metadata (contrast 7.5:1)
- **Riot Pink** (#E8553A) — The single accent: primary CTA, active chip, selected tab, focus ring, "hoje" badge
- **Riot Ink** (#1A0A06) — Text on Riot Pink fills (contrast 5.6:1)
- **Signal Green** (#4FB286) — "Grátis" / open-now status only
- **Alert Red** (#E0524D) — Errors only (kept distinct from Riot Pink by usage, never as a button fill)

Light theme: Paper (#F7F4EF) background, White (#FFFFFF) surface, Ink (#1C1A17) text, Stone (#6B655D) secondary, Riot Pink (#D6173F, 4.7:1 on Paper, for AA on light), same roles.
Rules: max one accent; no purple/blue neon, no gradient text, no glow shadows. Image scrims are neutral (black 0 to 60%) for legibility only.

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
- **Search bar:** 48px, Raised Ash, radius 16, label via placeholder AND accessible label.
- **Skeletons:** shimmer blocks matching exact card dimensions; no spinners.
- **Empty states:** a composed poster-style illustration and a specific next action ("Aumente o raio para 10 km").
- **Errors:** inline with retry; offline banner keeps cached results visible.
- **Tab bar:** Explorar, Mapa, Salvos, Perfil; 64px + safe area; active = Riot Pink icon + label.

## 5. Layout Principles
- Grid: 4pt base; screen gutters 16 (sm), 24 (md), 32 (lg). Content max-width 1280 on web.
- Breakpoints: sm <640 single column + bottom tabs; md 640-1023 two-column grid; lg >=1024 left rail + 3-4 column grid, map/list split view.
- Home composition is asymmetric: the first shelf ("Hoje à noite") uses one large lead card + stacked smaller cards at md+, not three equal cards.
- Use CSS grid on web, never calc() hacks; full-height uses 100dvh equivalents and safe-area insets.
- No overlapping content: text sits on scrims only inside image cards, otherwise in its own zone.
- Touch targets >= 44pt iOS / 48dp Android. No hover-only affordances.

## 6. Motion & Interaction
- Springs by default (Reanimated: stiffness 140, damping 18); no linear easing.
- Shelves and lists mount with staggered fade+translateY (40ms steps, max 8 items).
- Shared-element transition from card cover to event hero on supported platforms.
- Perpetual micro-motion limited to: skeleton shimmer, a soft pulse on the "Agora" live badge.
- Animate transform/opacity only. Respect Reduce Motion: replace springs with 120ms fades.

## 7. Iconography & Imagery
- Icons: one outline set (SF Symbols on iOS via expo-symbols, Material Symbols on Android/web), 24px, 1.75 stroke feel.
- Photography: crowd/stage/venue shots, 4:5 poster crop default, blurhash placeholders, WebP/AVIF via Supabase transforms.
- Seed imagery uses picsum.photos or generated SVG; real venue photos replace them in P4.

## 8. Copy Voice (pt-BR)
Casual, short, local. Examples: "Qual a boa hoje?", "Perto de você", "Até R$ 40", "Já passaram por aqui", "Ver ingressos". Gírias capixabas only where they read naturally. No marketing clichés. Mandatory 18+ and "beba com moderação" notices in onboarding and footer.

## 9. Anti-Patterns (Banned)
- Emojis as UI icons, Inter, pure black/white backgrounds, neon glows, purple/blue AI gradients.
- Three equal feature cards as a layout device, centered hero on md+.
- Nested cards inside cards, carousels without scroll affordance, hidden filter state.
- Placeholder names like "John Doe"/"Acme"; fake round stats; "Scroll to explore" text.
- Color as the only signal (always pair with text/icon); touch targets under 44pt.
