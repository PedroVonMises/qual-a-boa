import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';

const RINGS = [88, 62, 36];

/** Concentric radius illustration with a pin dot at the center. Decorative. */
export function RadiusArt({ size = 200 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="radius-art">
      {RINGS.map((r, i) => (
        <Circle
          key={r}
          cx={100}
          cy={100}
          r={r}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
          strokeOpacity={0.9 - i * 0.25}
          strokeDasharray={i === 0 ? '6 6' : undefined}
        />
      ))}
      <Circle cx={100} cy={100} r={16} fill={palette.riotPink} fillOpacity={0.25} />
      <Circle cx={100} cy={100} r={8} fill={colors.accent} />
    </Svg>
  );
}