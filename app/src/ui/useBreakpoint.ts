import { useWindowDimensions } from 'react-native';

import { breakpoints } from '@/theme/tokens';

export type Breakpoint = 'sm' | 'md' | 'lg';

export function breakpointFor(width: number): Breakpoint {
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  return 'sm';
}

const GUTTER: Record<Breakpoint, number> = { sm: 16, md: 24, lg: 32 };

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const breakpoint = breakpointFor(width);
  return { breakpoint, width, height, gutter: GUTTER[breakpoint], isLarge: breakpoint === 'lg' };
}
