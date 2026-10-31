import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/tokens';

export type IconName =
  | 'search' | 'pin' | 'heart' | 'heartFilled' | 'bookmark' | 'compass' | 'map' | 'user'
  | 'chevronLeft' | 'chevronRight' | 'chevronDown' | 'close' | 'check' | 'filter' | 'share'
  | 'send' | 'paperclip' | 'star' | 'starFilled' | 'headset' | 'clock' | 'plus'
  | 'message' | 'arrowUp' | 'spark';

const HEART = 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z';
const STAR = 'M12 3.8l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 17.1l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z';

interface Def {
  paths: string[];
  circles?: [number, number, number][];
  filled?: boolean;
}

const ICONS: Record<IconName, Def> = {
  search: { paths: ['M16 16l4 4'], circles: [[11, 11, 6.5]] },
  pin: { paths: ['M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z'], circles: [[12, 9.5, 2.5]] },
  heart: { paths: [HEART] },
  heartFilled: { paths: [HEART], filled: true },
  bookmark: { paths: ['M7 4h10v16l-5-3.5L7 20z'] },
  compass: { paths: ['M15.5 8.5l-2 5-5 2 2-5z'], circles: [[12, 12, 8.5]] },
  map: { paths: ['M9 5L3.5 7v12L9 17l6 2 5.5-2V5L15 7z', 'M9 5v12M15 7v12'] },
  user: { paths: ['M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6'], circles: [[12, 8.5, 3.5]] },
  chevronLeft: { paths: ['M14.5 5.5L8 12l6.5 6.5'] },
  chevronRight: { paths: ['M9.5 5.5L16 12l-6.5 6.5'] },
  chevronDown: { paths: ['M5.5 9.5L12 16l6.5-6.5'] },
  close: { paths: ['M6 6l12 12M18 6L6 18'] },
  check: { paths: ['M5 12.5l4.5 4.5L19 7.5'] },
  filter: { paths: ['M4 7h10M18 7h2M4 17h2M10 17h10'], circles: [[16, 7, 2], [8, 17, 2]] },
  share: { paths: ['M12 15V4M8 8l4-4 4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'] },
  send: { paths: ['M20 4L10.5 13.5M20 4l-6 16-3.5-6.5L4 10z'] },
  paperclip: {
    paths: ['M19 11l-7.5 7.5a4.5 4.5 0 0 1-6.4-6.4L13 4.2a3 3 0 0 1 4.300 4.300l-7.900 7.900a1.500 1.500 0 0 1-2.100-2.100L14 8'],
  },
  star: { paths: [STAR] },
  starFilled: { paths: [STAR], filled: true },
  headset: { paths: ['M4 14v-2a8 8 0 0 1 16 0v2', 'M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1z', 'M17 19c0 1.5-2 2-5 2'] },
  clock: { paths: ['M12 7.5V12l3 2'], circles: [[12, 12, 8.5]] },
  plus: { paths: ['M12 5v14M5 12h14'] },
  message: { paths: ['M5 5h14v10H9l-4 4z'] },
  arrowUp: { paths: ['M7 11l5-6 5 6M12 5v14'] },
  spark: { paths: ['M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z'], filled: true },
};

export interface IconProps {
  name: IconName;
  size?: number;
  /** Theme color role or a literal color. */
  color?: keyof ThemeColors | (string & {});
  strokeWidth?: number;
  testID?: string;
}

/** Outline icon set, 24px grid, 1.75 stroke. Decorative: hidden from screen readers. */
export function Icon({ name, size = 24, color = 'text', strokeWidth = 1.75, testID }: IconProps) {
  const { colors } = useTheme();
  const stroke = color in colors ? colors[color as keyof ThemeColors] : color;
  const def = ICONS[name];
  const fill = def.filled ? stroke : 'none';
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID ?? `icon-${name}`}>
      {def.paths.map((d) => (
        <Path key={d} d={d} fill={fill} />
      ))}
      {def.circles?.map(([cx, cy, r]) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </Svg>
  );
}
