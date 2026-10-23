import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** Neutral black scrim (0 to 60%) for legibility of text over images. No color, no glow. */
export function Scrim({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="qab-scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.35" stopColor="#000000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.72} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#qab-scrim)" />
      </Svg>
    </View>
  );
}
