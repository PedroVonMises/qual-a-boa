import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/** "Qual a boa?" in Outfit 700, tracking -2%. */
export function Wordmark({ size = 28, color, style }: { size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <RNText
      accessibilityRole="header"
      style={[
        { fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.1, letterSpacing: -size * 0.02, color: color ?? colors.text },
        style,
      ]}>
      Qual a boa?
    </RNText>
  );
}
