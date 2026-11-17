import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { REMINDER_BODY, REMINDER_TITLE } from '@/domain/volta';

/** Local reminders work on iOS and Android only; the web has no scheduled notifications. */
export const remindersSupported = () => Platform.OS === 'ios' || Platform.OS === 'android';

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/**
 * Schedules the "Já chegou?" local notification in `minutes`. Asks for permission on the spot (the person just chose a
 * reminder). Returns its id, or null when unsupported or not allowed. Never throws. Nothing leaves the device.
 */
export async function scheduleArrivalReminder(minutes: number): Promise<string | null> {
  if (!remindersSupported()) return null;
  try {
    ensureHandler();
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
    if (!granted) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title: REMINDER_TITLE, body: REMINDER_BODY, data: { url: '/volta' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, Math.round(minutes * 60)) },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(id: string | undefined): Promise<void> {
  if (!id || !remindersSupported()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or gone.
  }
}
