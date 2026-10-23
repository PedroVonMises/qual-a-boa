import { darkColors, lightColors, palette } from './tokens';

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('design tokens meet WCAG AA', () => {
  const pairs: [string, string, string, number][] = [
    ['dark text on background', darkColors.text, darkColors.background, 4.5],
    ['dark muted text on background', darkColors.textMuted, darkColors.background, 4.5],
    ['dark muted text on ash chips', darkColors.textMuted, darkColors.surfaceAlt, 4.5],
    ['dark accent text on ash', darkColors.accent, darkColors.surfaceAlt, 4.5],
    ['ink on accent button (dark)', darkColors.onAccent, darkColors.accent, 4.5],
    ['light text on paper', lightColors.text, lightColors.background, 4.5],
    ['light muted text on paper', lightColors.textMuted, lightColors.background, 4.5],
    ['light accent on paper', lightColors.accent, lightColors.background, 4.5],
    ['blush on wine', palette.blush, palette.wine, 4.5],
    ['amber on wine (graphics)', palette.amber, palette.wine, 3],
  ];

  it.each(pairs)('%s', (_name, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('never pairs bone text with the pink accent (2.8:1)', () => {
    expect(contrast(palette.bone, palette.riotPink)).toBeLessThan(4.5);
    expect(darkColors.onAccent).toBe(palette.riotInk);
  });
});
