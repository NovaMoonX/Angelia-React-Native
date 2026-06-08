import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const HANDLED_NOTIFICATION_RESPONSES_KEY = '@angelia/handled_notification_response_keys';
const MAX_PERSISTED_KEYS = 100;

const handledNotificationKeys = new Set<string>();
let persistedKeysLoaded = false;
let persistedKeysLoading: Promise<void> | null = null;

export function getNotificationResponseKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.request.identifier}_${response.notification.date}`;
}

async function ensurePersistedKeysLoaded(): Promise<void> {
  if (persistedKeysLoaded) {
    return;
  }

  if (!persistedKeysLoading) {
    persistedKeysLoading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(HANDLED_NOTIFICATION_RESPONSES_KEY);
        if (!raw) {
          return;
        }

        const keys = JSON.parse(raw) as unknown;
        if (!Array.isArray(keys)) {
          return;
        }

        keys.forEach((key) => {
          if (typeof key === 'string') {
            handledNotificationKeys.add(key);
          }
        });
      } catch {
        return;
      } finally {
        persistedKeysLoaded = true;
      }
    })();
  }

  await persistedKeysLoading;
}

async function persistHandledKeys(): Promise<void> {
  try {
    const keys = [...handledNotificationKeys].slice(-MAX_PERSISTED_KEYS);
    await AsyncStorage.setItem(HANDLED_NOTIFICATION_RESPONSES_KEY, JSON.stringify(keys));
  } catch {
    return;
  }
}

export async function isNotificationResponseHandled(
  response: Notifications.NotificationResponse,
): Promise<boolean> {
  await ensurePersistedKeysLoaded();
  return handledNotificationKeys.has(getNotificationResponseKey(response));
}

export async function markNotificationResponseHandled(
  response: Notifications.NotificationResponse,
): Promise<void> {
  await ensurePersistedKeysLoaded();

  const key = getNotificationResponseKey(response);
  if (handledNotificationKeys.has(key)) {
    return;
  }

  handledNotificationKeys.add(key);
  void persistHandledKeys();
}

/**
 * Returns true when this notification response should trigger navigation.
 * Dedupes within the current session and across cold starts via AsyncStorage.
 */
export async function consumeNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<boolean> {
  if (await isNotificationResponseHandled(response)) {
    return false;
  }

  await markNotificationResponseHandled(response);
  return true;
}
