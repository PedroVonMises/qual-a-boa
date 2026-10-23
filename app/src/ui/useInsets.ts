import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const ZERO = { top: 0, bottom: 0, left: 0, right: 0 };

/** Safe-area insets that fall back to zero when no SafeAreaProvider is mounted. */
export function useInsets() {
  return useContext(SafeAreaInsetsContext) ?? ZERO;
}
