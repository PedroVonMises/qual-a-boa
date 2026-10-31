// Design tokens. Documented in docs/DESIGN.md (sections 2-4, 7, 8); keep both in sync. Do not hardcode these values elsewhere.

export const palette = {
  // Dark theme (default)
  night: '#121110', // app background
  soot: '#1B1A18', // cards, sheets, tab bar
  ash: '#262421', // idle chips, inputs
  hairline: 'rgba(255,255,255,0.08)',
  bone: '#F4F1EC', // primary text
  dusk: '#A8A29A', // secondary text
  riotPink: '#FF4F81', // the single UI accent
  riotInk: '#1A0A06', // text on riotPink
  signalGreen: '#4FB286', // free / open / verified
  alertRed: '#E0524D', // errors only
  alertRedText: '#FF8A86', // error text on dark
  // Brand depth (brand art, splash, posters)
  wine: '#3A1220',
  burgundy: '#6B1D3A',
  blush: '#FFC2D1',
  amber: '#F2A65A', // light only: the bulb core, glows, star ratings
  // Light theme
  paper: '#F7F4EF',
  white: '#FFFFFF',
  ink: '#1C1A17',
  stone: '#6B655D',
  riotPinkOnLight: '#D01B58',
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  success: string;
  danger: string;
  dangerText: string;
};

export const darkColors: ThemeColors = {
  background: palette.night,
  surface: palette.soot,
  surfaceAlt: palette.ash,
  border: palette.hairline,
  text: palette.bone,
  textMuted: palette.dusk,
  accent: palette.riotPink,
  onAccent: palette.riotInk,
  success: palette.signalGreen,
  danger: palette.alertRed,
  dangerText: palette.alertRedText,
};

export const lightColors: ThemeColors = {
  background: palette.paper,
  surface: palette.white,
  surfaceAlt: '#ECE7DF',
  border: 'rgba(28,26,23,0.12)',
  text: palette.ink,
  textMuted: palette.stone,
  accent: palette.riotPinkOnLight,
  onAccent: palette.white,
  success: '#2E7D5B',
  danger: '#B3261E',
  dangerText: '#B3261E',
};

/** Font family names as registered by `useFonts` (see fonts.ts). */
export const fonts = {
  display: 'Outfit_700Bold',
  displaySemi: 'Outfit_600SemiBold',
  body: 'Geist_400Regular',
  bodyMedium: 'Geist_500Medium',
  bodySemi: 'Geist_600SemiBold',
  mono: 'GeistMono_500Medium',
} as const;

/** Type scale in px (sp). Minimum body size is 14. */
export const type = {
  caption: { fontSize: 12, lineHeight: 16 },
  bodySm: { fontSize: 14, lineHeight: 20 },
  body: { fontSize: 16, lineHeight: 24 },
  title: { fontSize: 20, lineHeight: 26 },
  headline: { fontSize: 24, lineHeight: 30 },
  display: { fontSize: 32, lineHeight: 36 },
  displayLg: { fontSize: 44, lineHeight: 46 },
} as const;

/** 4pt base spacing. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 12,
  md: 16, // buttons, inputs
  lg: 24, // cards
  xl: 28, // sheets
  full: 999,
} as const;

/** Minimum touch target (pt/dp). */
export const hit = { min: 44, button: 52, chip: 44 } as const;

/** Responsive breakpoints in px of window width. */
export const breakpoints = { sm: 0, md: 640, lg: 1024 } as const;
export const maxContentWidth = 1280;

/** Motion. Use springs; animate transform/opacity only; respect Reduce Motion. */
export const motion = {
  spring: { stiffness: 140, damping: 18, mass: 1 },
  stagger: 40,
  reducedFadeMs: 120,
  splash: { drawMs: 700, flickerMs: 650, wordDelayMs: 1350 },
} as const;
