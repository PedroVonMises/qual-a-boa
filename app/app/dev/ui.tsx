import { Redirect } from 'expo-router';

// Dev-only: every design-system component in all states. The gallery is required lazily under
// __DEV__ so production bundles drop it.
export default function Screen() {
  if (!__DEV__) return <Redirect href="/" />;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Gallery } = require('@/ui/Gallery') as typeof import('@/ui/Gallery');
  return <Gallery />;
}
