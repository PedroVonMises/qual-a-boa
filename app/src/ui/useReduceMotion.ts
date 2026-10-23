import { useReducedMotion } from 'react-native-reanimated';

/** True when the OS asks for reduced motion. Single seam so tests can mock it. */
export function useReduceMotion(): boolean {
  return useReducedMotion();
}
