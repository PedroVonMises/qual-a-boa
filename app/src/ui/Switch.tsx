import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { hit, motion, radius } from '@/theme/tokens';
import { lightHaptic } from './haptics';
import { Text } from './Text';
import { useReduceMotion } from './useReduceMotion';

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 24;
const PAD = 4;

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 52x32 switch. The whole labelled row is the 44px+ hit target; state is exposed as "checked". */
export function Switch({ value, onValueChange, label, disabled, style, testID }: SwitchProps) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const x = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    x.value = reduce ? withTiming(value ? 1 : 0, { duration: motion.reducedFadeMs }) : withSpring(value ? 1 : 0, motion.spring);
  }, [value, reduce, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (TRACK_W - THUMB - PAD * 2) }] }));

  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        lightHaptic();
        onValueChange(!value);
      }}
      style={[styles.row, disabled && styles.disabled, style]}>
      <Text variant="body" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: value ? colors.accent : colors.surfaceAlt, borderColor: colors.border }]}>
        <Animated.View style={[styles.thumb, { backgroundColor: value ? colors.onAccent : colors.textMuted }, thumb]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: hit.min, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1 },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    padding: PAD - StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.full },
  disabled: { opacity: 0.4 },
});
