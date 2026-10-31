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

## 10. Logo (added 2026-10-22)
- **Concept:** a light bulb rotated 45 degrees reads as a "Q": the globe is the ring, the screw base is the tail, the amber core is the light on. Tagline: "Acende a noite."
- **Files:** `app/assets/brand/mark.svg` (full color), `mark-mono.svg` (one color), `app-icon.svg` (dark rounded square). Wordmark is "Qual a boa?" in Outfit 700, tracking -2%; it is live text in the design, not an SVG, so outline it before shipping.
- **Colors:** ring and base Riot Pink `#FF4F81`, core Amber `#F2A65A` (the only place amber is allowed outside imagery). On pink backgrounds use the mono mark in Riot Ink `#1A0A06`.
- **Rules:** minimum size 16px; clear space equal to the core diameter; never bone/white on Riot Pink (2.8:1).
- **Alternatives kept on the canvas (Marca board):** B filament tail, C Q inside a bulb. A chosen for legibility at small sizes.

## 11. Refinements (added 2026-10-22)
- Chips and all tap targets are 44px tall minimum (was 40px for chips).
- Selected chips show a check icon in addition to the pink fill.
- Active tab shows a 3px top indicator in addition to the pink color.
- Empty states use the unlit bulb (mark in Ash tones) with a specific next action.

## 12. Brand direction "Q?" (supersedes the bulb logo, 2026-10-22)
- **Mark (B, chosen):** a Q whose tail is the hook of a question mark, ending in a lit amber dot. Files: `app/assets/brand/mark-q.svg` (color), `mark-q-mono.svg`, `mark-q-neon.svg` (brand art only), `app-icon-q.svg` (wine gradient). The earlier bulb-Q (`mark.svg`) stays as an alternative.
- **Rejected:** a Q with an inner "?" (version A) because it reads as the search/magnifier icon in a discovery app.
- **Wordmark:** lowercase "qual a boa?" in Outfit 700, tracking -3%, final "?" in Riot Pink. Outline the text before shipping.
- **Color depth added:** Wine `#3A1220`, Burgundy `#6B1D3A`, Blush `#FFC2D1`. Amber `#F2A65A` is reserved for light (the dot, glows). Gradients only wine to burgundy in brand art.
- **Contrast:** Blush on Wine 10.8, on Burgundy 7.5; Bone on Wine 14.5, on Burgundy 10.0; Amber on Wine 8.1; Pink on Wine 5.2 (ok for text); **Pink on Burgundy 3.6 (graphics and text of 24px+ only)**; Ink on Pink 6.1.
- **Glow:** allowed only in brand art (neon mark, splash). UI never glows.
- **Motion:** splash draws the ring and hook on (700 ms), then the dot flickers on; with Reduce Motion it shows the final lit state.
- **Trademark:** run an INPI search for "Qual a boa?" and the mark before launch.

## 13. Decision update: the light bulb is the single logo (2026-10-23)
- The bulb mark (`mark.svg`, `mark-mono.svg`, `app-icon.svg`) is the only logo. The Q? exploration is archived in `app/assets/brand/alt-q/` and no longer used. Section 12 is superseded.
- **Wordmark:** "Qual a boa?" with a capital Q, Outfit 700, tracking -2%.
- **Neon variations (brand art only):** `mark-neon.svg` (four layers: blurred glow, pink tube, blush core, amber light), neon sign lockup (CSS text-shadow glow), neon app icon for the store, wine-gradient icon `app-icon-wine.svg`. UI never glows.
- **Sticker/pattern:** circular "Tá na Qual a boa?" decal with the bulb and "hoje"; bulb pattern at 4-8% opacity on pink.
- **Splash:** tube and base draw on, then the amber core flickers on; Reduce Motion shows the lit logo.

## 14. UX flows added (2026-10-23)
- **Event tracking:** Acompanhando (timeline Salvo / Ingresso / Dia do evento / Avaliar, countdown, change feed with unread markers), Avisos (per-event toggles and channels), Ao vivo (queue, crowd, music, price from community reports with age and sample size, a pre-departure checklist, "Estou aqui").
- **Feedback and reviews:** Avaliar in two steps (rating + topics + tags, then text + photo + anonymous option), Avaliações do evento (distribution, topic scores, "Foi ao evento" verified badge, helpful/report actions).
- **Support messaging:** Ajuda (search, common topics, open ticket, expected response time), Mensagens (ticket inbox with text status chips), Conversa com o suporte (event context card, quick replies, read receipts, typing, attach, security reminder), Novo chamado (topic radio list, related event, validated description, optional screenshot).
- **UX rules used:** status never by color alone (text chips, icons, check marks); every tappable 44px+; honest data labels ("Relatos de 14 pessoas, o último há 12 min"); response-time expectations stated before contact; inline field errors with the fix; demonstration content (reviews, live status, updates) exists only for Casa Maré and carries no mock tags in the UI (owner decision, Wave 7); the Terms say the pilot may show demonstration content until listings are verified with each venue. Never invent reviews or status for other venues.

## 15. UX gaps closed (2026-10-29)
- **Busca:** dedicated screen opened by the search key or "Buscar em casas e artistas"; results grouped Casas / Eventos / Artistas with count chips, widest radius, recent searches kept only on the device.
- **Quando:** sheet with quick ranges (Hoje, Amanhã, Fim de semana, Próxima semana, Qualquer dia) and a calendar; nights run 06:00 to 05:59 like "Hoje". Opened from the date pill in Explorar and from Filtros > Data.
- **Ingressos:** a step before the external ticket site: published price, quantity estimate, meia-entrada rule, and the exact host where the purchase ends. The app never sells tickets.
- **Chamar a galera:** editable invite sent via WhatsApp (wa.me), copy (web) or the system share sheet.
- **Offline:** floating banner above the tab bar; cached results stay on screen. Native needs a connectivity source wired into TanStack `onlineManager`.
- **Privacidade e dados:** permissions, what stays on the device, clear searches, reset recommendations, export/erase (account) or wipe (visitor), legal drafts.
- Not built on purpose (needs contracts or setup): ticket tiers/lotes data, Google/Apple sign-in, Instagram Stories share, the "Vai ou não vai?" poll, a time-of-night filter.
