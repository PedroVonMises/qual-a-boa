import { Redirect, useSegments } from 'expo-router';

import { useSession } from '@/state/session';

/**
 * Renders a redirect to the pending onboarding step, or nothing.
 * Render it next to the navigator (the navigator must be mounted). Waits for hydration.
 */
export function SessionGuard() {
  const segments = useSegments() as string[];
  const { hydrated, ageConfirmed, onboardingDone } = useSession();
  if (!hydrated) return null;

  const inOnboarding = segments[0] === 'onboarding';
  if (!ageConfirmed) {
    return inOnboarding && segments[1] === 'idade' ? null : <Redirect href="/onboarding/idade" />;
  }
  if (!onboardingDone) {
    return inOnboarding && segments[1] === 'local' ? null : <Redirect href="/onboarding/local" />;
  }
  return null;
}
