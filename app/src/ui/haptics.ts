import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Light impact on native; no-op on web or when the device has no haptics. */
export function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
