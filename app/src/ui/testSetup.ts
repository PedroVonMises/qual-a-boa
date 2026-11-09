/* eslint-disable @typescript-eslint/no-require-imports */
/* Import this first in every test file. Reanimated 4's own jest mock needs the native module,
 * so UI tests use this lightweight stand-in (plain RN views, values applied synchronously). */
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const RN = require('react-native');
  const id = (v: unknown) => v;
  const Animated = {
    View: RN.View,
    Text: RN.Text,
    ScrollView: RN.ScrollView,
    createAnimatedComponent: (C: unknown) => C,
  };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (v: unknown) =>
      React.useRef({
        value: v,
        get() {
          return this.value;
        },
        set(n: unknown) {
          this.value = n;
        },
      }).current,
    // Live view of the style: each property re-runs `fn`, so a shared value set after render (a mount animation
    // finishing in an effect) is visible to tests without needing a re-render.
    useAnimatedStyle: (fn: () => Record<string, unknown>) => {
      const live: Record<string, unknown> = {};
      for (const key of Object.keys(fn())) Object.defineProperty(live, key, { enumerable: true, get: () => fn()[key] });
      return live;
    },
    useAnimatedProps: (fn: () => unknown) => fn(),
    useReducedMotion: () => false,
    withSpring: id,
    withTiming: id,
    withRepeat: id,
    withDelay: (_d: number, a: unknown) => a,
    withSequence: (...a: unknown[]) => a[a.length - 1],
    Easing: { out: id, in: id, inOut: id, cubic: id, quad: id },
  };
});

/* Native-heavy libs the kit imports: bottom sheet gets its official mock, FlashList becomes a FlatList. */
jest.mock('@gorhom/bottom-sheet', () => ({ __esModule: true, ...require('@gorhom/bottom-sheet/mock') }));
jest.mock('@shopify/flash-list', () => ({ __esModule: true, FlashList: require('react-native').FlatList }));

/* Gesture Handler v3: the detector needs a native root view, so tests get a pass-through View that keeps the
 * gesture config on its props (`gesture`) and hooks that return their config, letting tests call the callbacks. */
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const RN = require('react-native');
  const actual = jest.requireActual('react-native-gesture-handler');
  const cfg = (c: unknown) => c ?? {};
  return {
    ...actual,
    GestureDetector: ({ gesture, children }: { gesture: unknown; children: unknown }) =>
      React.createElement(RN.View, { testID: 'gesture-detector', gesture }, children),
    usePanGesture: cfg,
    useTapGesture: cfg,
  };
});
