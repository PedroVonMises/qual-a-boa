import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { palette } from '@/theme/tokens';

type Props = { size?: number; lit?: boolean };

/**
 * Static brand bulb (paths from assets/brand/mark.svg).
 * Placeholder until the ui agent's AnimatedLogo replaces it in the splash.
 */
export function BrandBulb({ size = 96, lit = true }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityLabel="Qual a boa?">
      <G transform="translate(88 88) rotate(-45)">
        <G fill="none" stroke={palette.riotPink} strokeWidth={16} strokeLinecap="round">
          <Path d="M29.1 54.7A62 62 0 1 0 -29.1 54.7" />
          <Path d="M29.1 54.7L21 72M-29.1 54.7L-21 72" />
        </G>
        <Rect x={-21} y={78} width={42} height={13} rx={6.5} fill={palette.riotPink} />
        <Rect x={-15} y={95} width={30} height={11} rx={5.5} fill={palette.riotPink} />
        <Circle cx={0} cy={-2} r={13} fill={palette.amber} opacity={lit ? 1 : 0.25} />
      </G>
    </Svg>
  );
}
