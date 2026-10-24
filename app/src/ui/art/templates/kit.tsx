import type { ReactNode } from 'react';
import { Defs, G, Path, Rect } from 'react-native-svg';

import type { ArtPalette } from '../palettes';
import { Grad } from '../parts';

export interface TemplateProps {
  palette: ArtPalette;
  variant: string;
  /** Unique per rendered cover; prefix for every gradient/clip/mask id. */
  uid: string;
}
export type Template = (props: TemplateProps) => ReactNode;

/** Variant transforms the motif group around the poster center; backgrounds are drawn outside it. */
export function variantTransform(variant: string): string | undefined {
  switch (variant) {
    case 'b':
      return 'translate(400 0) scale(-1 1)';
    case 'c':
      return 'translate(200 250) scale(1.14) translate(-200 -250)';
    case 'd':
      return 'translate(200 250) scale(-0.88 0.88) translate(-200 -250)';
    default:
      return undefined;
  }
}

/** Two-stop background plus a transformed motif group. Full-bleed shapes inside must span -250..650. */
export function Poster({
  palette,
  variant,
  uid,
  defs,
  children,
}: TemplateProps & { defs?: ReactNode; children: ReactNode }) {
  return (
    <>
      <Defs>
        <Grad id={`${uid}-bg`} stops={[[0, palette.bg1], [1, palette.bg2]]} />
        {defs}
      </Defs>
      <Rect width={400} height={500} fill={`url(#${uid}-bg)`} />
      <G transform={variantTransform(variant)}>{children}</G>
    </>
  );
}

/** Four-point sparkle centered on (cx, cy). */
export function sparkle(cx: number, cy: number, r: number): string {
  const k = r * 0.18;
  return `M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}Z`;
}

/** Wavy band filled down to the bottom edge, spanning -250..650. */
export function wavePath(y: number, amp: number, step = 100): string {
  let d = `M-250 ${y}`;
  let up = true;
  for (let x = -250; x < 650; x += step) {
    d += `Q${x + step / 2} ${up ? y - amp * 2 : y + amp * 2} ${x + step} ${y}`;
    up = !up;
  }
  return `${d}L650 700L-250 700Z`;
}

export const Sparkle = ({ cx, cy, r, fill, opacity }: { cx: number; cy: number; r: number; fill: string; opacity?: number }) => (
  <Path d={sparkle(cx, cy, r)} fill={fill} opacity={opacity} />
);
