# Design audit — mockups (2026-10-22)

Scope: HTML mockups on the Artifact canvas (generic screens 1-5, real-venue screens R1-R10, new screens N1-N7, brand board M).
Method: a manual review of the markup against the `design:design-critique` and `design:accessibility-review` checklists (WCAG 2.1 AA), plus computed contrast ratios. **Not** tested with VoiceOver/TalkBack, a browser, or Lighthouse yet; that is a P5 gate.

## Contrast (computed)
| Pair | Ratio | Needed | Result |
|---|---|---|---|
| Bone `#F4F1EC` on Night `#121110` | 16.7 | 4.5 | pass |
| Dusk `#A8A29A` on Night / Soot / Ash | 7.5 / 6.9 / 6.1 | 4.5 | pass |
| Riot Pink `#FF4F81` on Night / Soot / Ash | 6.0 / 5.5 / 4.9 | 4.5 (text), 3 (icons) | pass |
| Riot Ink `#1A0A06` on Riot Pink | 6.1 | 4.5 | pass |
| Light-theme pink `#D01B58` on Paper | 4.8 | 4.5 | pass |
| Bone on Riot Pink | 2.8 | 4.5 | **fail: never use**; always Riot Ink on pink |
| Muted "off" bulb `#3A3835` on Night (empty state) | 1.6 | 3 (graphic) | minor: decorative, headline carries the meaning |

## Findings and status
| # | Finding | Sev | Status |
|---|---|---|---|
| 1 | Tab bar showed the active tab by color only | Major | **Fixed**: 3px indicator + `aria-current="page"` on R1, R3, N3, N4 |
| 2 | Selected filter chips differed by color only | Major | **Fixed**: check icon on selected chips (R1, R2, N2) |
| 3 | Chips were 40px tall (below 44px target) | Moderate | **Fixed** in R1, R2, N2, N6, N7; original screens 1-3 still 40px |
| 4 | Salvos/Perfil tabs linked back to Explorar | Moderate | **Fixed**: new Salvos and Perfil screens linked |
| 5 | No age gate or onboarding | Major (legal/store review) | **Fixed**: N1 (18+ gate), N2 (location + styles) |
| 6 | No empty or no-results state | Moderate | **Fixed**: N6 |
| 7 | No desktop layout | Moderate | **Fixed**: N7 (rail + 4-col asymmetric grid) |
| 8 | Map pin selected state is a color change (pink vs white) | Minor | Open: add a larger pin + label weight for selected |
| 9 | Map "you are here" blue is outside the palette | Minor | Accepted (map convention) |
| 10 | 12px captions (tags, tab labels) | Minor | Open: raise tags to 13px at implementation; keep 12 for tab labels |
| 11 | Price slider thumb is 24px | Moderate | Open: 44px hit area wrapper exists; thumb stays 24px visual |
| 12 | Cover art is decorative `alt=""` | n/a | OK: event/venue names are always in adjacent text |
| 13 | Switch in Perfil has role and label but no focus style drawn | Minor | Open: define focus ring (2px Riot Pink offset 2px) in the component spec |
| 14 | Real venue names with invented events/line-ups | Legal | Open: placeholders only; replace with consented data before launch (see VENUES.md) |
| 15 | Casa Caipora is closed; Sinner Club is an adult venue | Content | Closed state designed (R10); Sinner not designed, needs a policy |

## Open gates before any launch
- Test with VoiceOver (iOS), TalkBack (Android), keyboard on web, 200% text scaling.
- Lighthouse a11y and perf on the Expo web build.
- Pt-BR copy review (`design:ux-copy`) for onboarding, empty states and legal text.
