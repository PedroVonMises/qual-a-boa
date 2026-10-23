import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, type, type ThemeColors } from '@/theme/tokens';

export type TextVariant = 'display' | 'headline' | 'title' | 'body' | 'bodySm' | 'caption' | 'mono';

const VARIANTS = {
  display: { ...type.display, fontFamily: fonts.display, letterSpacing: -0.64 },
  headline: { ...type.headline, fontFamily: fonts.display, letterSpacing: -0.36 },
  title: { ...type.title, fontFamily: fonts.displaySemi, letterSpacing: -0.2 },
  body: { ...type.body, fontFamily: fonts.body },
  bodySm: { ...type.bodySm, fontFamily: fonts.bodyMedium },
  caption: { ...type.caption, fontFamily: fonts.bodyMedium },
  mono: { ...type.bodySm, fontFamily: fonts.mono },
} as const;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** Theme color role, or a literal color string. */
  tone?: keyof ThemeColors | (string & {});
}

export function Text({ variant = 'body', tone = 'text', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const color = tone in colors ? colors[tone as keyof ThemeColors] : tone;
  return <RNText {...rest} style={[VARIANTS[variant], { color }, style]} />;
}
