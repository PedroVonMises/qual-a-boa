import Svg, { Circle, Defs, FeGaussianBlur, Filter, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';

export type LogoVariant = 'color' | 'mono' | 'neon' | 'off';

/** Geometry shared with app/assets/brand/mark*.svg (viewBox 0 0 200 200, rotated -45). */
export const MARK = {
  arc: 'M29.1 54.7A62 62 0 1 0 -29.1 54.7',
  legs: 'M29.1 54.7L21 72M-29.1 54.7L-21 72',
  base1: { x: -21, y: 78, width: 42, height: 13, rx: 6.5 },
  base2: { x: -15, y: 95, width: 30, height: 11, rx: 5.5 },
  core: { cx: 0, cy: -2, r: 13 },
  transform: 'translate(88 88) rotate(-45)',
} as const;

const OFF_TUBE = '#4A453F';
const OFF_CORE = '#5C564E';
const CORE_HIGHLIGHT = '#FFE2A8';

export interface LogoProps {
  size?: number;
  variant?: LogoVariant;
  /** Mono variant color; defaults to the theme text color. */
  monoColor?: string;
}

function Tube({ stroke, width }: { stroke: string; width: number }) {
  return (
    <G fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round">
      <Path d={MARK.arc} />
      <Path d={MARK.legs} />
    </G>
  );
}

function Base({ fill }: { fill: string }) {
  return (
    <>
      <Rect {...MARK.base1} fill={fill} />
      <Rect {...MARK.base2} fill={fill} />
    </>
  );
}

export function Logo({ size = 48, variant = 'color', monoColor }: LogoProps) {
  const { colors } = useTheme();
  const label = variant === 'off' ? 'Qual a boa?, apagada' : 'Qual a boa?';
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityRole="image" accessibilityLabel={label}>
      {variant === 'neon' ? (
        <>
          <Defs>
            <Filter id="qab-glow" x="-40%" y="-40%" width="180%" height="180%">
              <FeGaussianBlur stdDeviation="6" />
            </Filter>
          </Defs>
          <G transform={MARK.transform}>
            <G opacity={0.6} filter="url(#qab-glow)">
              <Tube stroke={palette.riotPink} width={12} />
              <Base fill={palette.riotPink} />
            </G>
            <Tube stroke={palette.riotPink} width={7} />
            <Base fill={palette.riotPink} />
            <Tube stroke={palette.blush} width={2.5} />
            <Circle cx={0} cy={-2} r={22} fill={palette.amber} opacity={0.55} filter="url(#qab-glow)" />
            <Circle cx={0} cy={-2} r={11} fill={palette.amber} />
            <Circle cx={-3} cy={-5} r={4} fill={CORE_HIGHLIGHT} />
          </G>
        </>
      ) : (
        <G transform={MARK.transform}>
          <Tube
            stroke={variant === 'mono' ? (monoColor ?? colors.text) : variant === 'off' ? OFF_TUBE : palette.riotPink}
            width={16}
          />
          <Base fill={variant === 'mono' ? (monoColor ?? colors.text) : variant === 'off' ? OFF_TUBE : palette.riotPink} />
          <Circle
            {...MARK.core}
            fill={variant === 'mono' ? (monoColor ?? colors.text) : variant === 'off' ? OFF_CORE : palette.amber}
          />
        </G>
      )}
    </Svg>
  );
}
