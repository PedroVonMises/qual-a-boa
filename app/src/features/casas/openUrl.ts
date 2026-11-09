import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * Opens a Stripe page (Checkout or Customer Portal). On web the tab navigates there, so Stripe's success/cancel URL
 * (`/casas/assinatura?status=...`) brings the user back into the app. On native it opens the in-app browser and
 * resolves when the user closes it; the caller then routes to the subscription screen, which re-reads the status.
 */
export async function openStripePage(url: string): Promise<'navigated' | 'closed'> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return 'navigated';
  }
  await WebBrowser.openBrowserAsync(url);
  return 'closed';
}
