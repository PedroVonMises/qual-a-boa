import { useEffect, useRef, type ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme/tokens';
import { useReduceMotion } from './useReduceMotion';

/** Items beyond the 8th appear together with the 8th (docs/DESIGN.md: stagger capped at 8). */
export const REVEAL_MAX_STAGGER = 7;
/** Only the first rows of a list animate in (docs/DESIGN.md: at most 8); later pages append quietly. */
export const REVEAL_MAX_ITEMS = 8;
/** How far content rises while it fades in, in px. Opacity and translate only. */
export const REVEAL_RISE = 8;

/** Entrance delay for the item at `index`: 40 ms steps, capped. */
export function revealDelay(index = 0): number {
  return Math.min(Math.max(Math.floor(index), 0), REVEAL_MAX_STAGGER) * motion.stagger;
}

/**
 * Remembers which items of a list already played their entrance, so a recycled or re-mounted row (FlashList,
 * scrolling back to the top, a filter returning to a known list) does not animate again.
 */
export interface RevealScope {
  has: (id: string) => boolean;
  add: (id: string) => void;
}

export function useRevealScope(): RevealScope {
  const seen = useRef<Set<string> | null>(null);
  seen.current ??= new Set();
  const set = seen.current;
  return useRef<RevealScope>({ has: (id) => set.has(id), add: (id) => void set.add(id) }).current;
}

export interface RevealProps {
  children: ReactNode;
  /** Position in the list: sets the stagger delay. */
  index?: number;
  /** Skip the entrance (content shows at once). */
  disabled?: boolean;
  /** Rise while fading (default). False = opacity only, for whole screens and large areas. */
  rise?: boolean;
  /** With `id`: plays once per id for the lifetime of the scope. */
  scope?: RevealScope;
  id?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Fade-and-rise entrance on mount. Springs from the design tokens; under Reduce Motion it is a plain 120 ms fade with no
 * movement. It only runs when the component mounts, so it never fights a list's own layout.
 */
export function Reveal({ children, index = 0, disabled = false, rise = true, scope, id, style, testID }: RevealProps) {
  const reduce = useReduceMotion();
  const skip = disabled || (!!scope && id !== undefined && scope.has(id));
  const progress = useSharedValue(skip ? 1 : 0);

  useEffect(() => {
    if (skip) {
      progress.set(1);
      return;
    }
    if (scope && id !== undefined) scope.add(id);
    progress.set(
      reduce
        ? withTiming(1, { duration: motion.reducedFadeMs })
        : withDelay(revealDelay(index), withSpring(1, motion.spring)),
    );
    // Mount only: a later prop change must not replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduce || !rise ? [] : [{ translateY: (1 - progress.value) * REVEAL_RISE }],
  }));

  return (
    <Animated.View testID={testID} style={[anim, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Fades a whole screen body in (opacity only, no movement) when it mounts: on web, where the stack has no push
 * animation, and on any platform when a detail screen's content replaces its loading skeleton. Fills its parent.
 */
export function ScreenFade({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <Reveal rise={false} disabled={disabled} style={{ flex: 1 }}>
      {children}
    </Reveal>
  );
}

export interface SwapProps {
  /** When this changes the content eases in again (the first render does not animate). */
  swapKey: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Wraps text that changes in place (the Explorar header when the date changes): the new content settles in with a
 * short fade and rise instead of snapping. Under Reduce Motion: a 120 ms fade, no movement.
 */
export function Swap({ swapKey, children, style, testID }: SwapProps) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(1);
  const last = useRef(swapKey);

  useEffect(() => {
    if (last.current === swapKey) return;
    last.current = swapKey;
    progress.set(0);
    progress.set(reduce ? withTiming(1, { duration: motion.reducedFadeMs }) : withSpring(1, motion.spring));
  }, [swapKey, reduce, progress]);

  const anim = useAnimatedStyle(() => ({
    opacity: 0.2 + 0.8 * progress.value,
    transform: reduce ? [] : [{ translateY: (1 - progress.value) * (REVEAL_RISE / 2) }],
  }));

  return (
    <Animated.View testID={testID} style={[anim, style]}>
      {children}
    </Animated.View>
  );
}
