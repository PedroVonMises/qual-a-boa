import { Circle, LinearGradient, Path, Stop } from 'react-native-svg';
import type { ReactNode } from 'react';

/** Shared bits for the drawn covers. Art colors are brand-art literals ported from app/assets/art/*.svg. */
export const ART_W = 400;
export const ART_H = 500;
export const INK = '#0B0A09';

export function Grad({
  id,
  stops,
  x2 = 0,
  y2 = 1,
}: {
  id: string;
  stops: [number, string, number?][];
  x2?: number;
  y2?: number;
}): ReactNode {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2={String(x2)} y2={String(y2)}>
      {stops.map(([o, c, op]) => (
        <Stop key={o} offset={String(o)} stopColor={c} stopOpacity={op ?? 1} />
      ))}
    </LinearGradient>
  );
}


/**
 * Crowd silhouette (port of the <symbol id="p|pa"> in bolt/gordinho.svg).
 * viewBox 0 0 40 70, or -8 -4 56 74 with raised arms; meet-fit and centered into (w, h).
 */
export function Person({ x, y, w, h, arms, fill = INK }: { x: number; y: number; w: number; h: number; arms?: boolean; fill?: string }) {
  const [vx, vy, vw, vh] = arms ? [-8, -4, 56, 74] : [0, 0, 40, 70];
  const s = Math.min(w / vw, h / vh);
  const tx = x + (w - vw * s) / 2 - vx * s;
  const ty = y + (h - vh * s) / 2 - vy * s;
  return (
    <>
      <Circle cx={tx + 20 * s} cy={ty + 14 * s} r={11 * s} fill={fill} />
      <Path
        d="M0 70C0 40 8 30 20 30s20 10 20 40z"
        fill={fill}
        transform={`translate(${tx} ${ty}) scale(${s})`}
      />
      {arms ? (
        <Path
          d="M8 42L-2 6M32 42L42 6"
          stroke={fill}
          strokeWidth={7 * s}
          strokeLinecap="round"
          fill="none"
          transform={`translate(${tx} ${ty}) scale(${s})`}
        />
      ) : null}
    </>
  );
}
