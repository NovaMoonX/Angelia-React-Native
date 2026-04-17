import notifee, {
  AndroidImportance,
  RepeatFrequency,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import type { NotificationSettings } from '@/models/types';

// ---- Constants ----

const CHANNEL_ID = 'daily-prompt';
const NOTIFICATION_ID = 'daily-prompt';

const DAILY_PROMPTS = [
  "What are you up to? People want to know. ✨",
  "Anything small worth sharing today? 💫",
  "A tiny life update still counts. 🌙",
  "Hey! What's been going on? 💛",
  "Share something, anything — we're all ears. 🌟",
];

// ---- Timezone helpers ----

/**
 * Returns the device's IANA timezone string (e.g. "America/New_York").
 * Falls back to "UTC" if unavailable.
 */
export function getDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Computes the next UTC millisecond timestamp at which the given hour of day
 * occurs in the specified IANA timezone. If that time has already passed today
 * (within a 1-minute buffer) the next day's occurrence is returned instead.
 */
export function getNextDailyTriggerMs(hourOfDay: number, timeZone: string): number {
  const now = Date.now();

  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    // Get the local date string (YYYY-MM-DD) in the target timezone for
    // "now + dayOffset full days". We use en-CA locale because its default
    // date format is ISO-like (YYYY-MM-DD).
    const probe = new Date(now + dayOffset * 86_400_000);
    const localDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(probe);

    const [y, m, d] = localDateStr.split('-').map(Number);

    // Build a naive UTC timestamp: "this local date at hourOfDay:00:00 UTC".
    // Then check what local hour that maps to and correct for the offset.
    const naiveUTC = Date.UTC(y, m - 1, d, hourOfDay, 0, 0);
    const naiveLocalHour = getLocalHour(naiveUTC, timeZone);
    const offsetMs = (naiveLocalHour - hourOfDay) * 3_600_000;
    let candidate = naiveUTC - offsetMs;

    // One correction pass for DST edge cases
    if (getLocalHour(candidate, timeZone) !== hourOfDay) {
      candidate -= (getLocalHour(candidate, timeZone) - hourOfDay) * 3_600_000;
    }

    if (candidate > now + 60_000) {
      return candidate;
    }
  }

  return now + 86_400_000; // fallback: 24 h from now
}

function getLocalHour(utcMs: number, timeZone: string): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(
      new Date(utcMs),
    ),
    10,
  );
}

// ---- Permissions ----

/**
 * Requests both FCM (remote) and Notifee (local) notification permissions.
 * Returns true when the user grants permission.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  const fcmGranted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  const notifeeStatus = await notifee.requestPermission();
  const notifeeGranted =
    notifeeStatus.authorizationStatus >= 1; // 1 = AUTHORIZED, 2 = PROVISIONAL

  return fcmGranted && notifeeGranted;
}

// ---- FCM token ----

/**
 * Returns the current FCM registration token, or null if unavailable.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    return token || null;
  } catch {
    return null;
  }
}

// ---- Local notification scheduling ----

async function ensureAndroidChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Daily Prompts',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

/**
 * Schedules (or reschedules) the daily prompt notification based on current settings.
 * Safe to call multiple times — it cancels any existing daily prompt first.
 */
export async function scheduleDailyPrompt(settings: NotificationSettings): Promise<void> {
  await cancelDailyPrompt();

  if (!settings.dailyPromptEnabled) return;

  await ensureAndroidChannel();

  const triggerMs = getNextDailyTriggerMs(settings.dailyPromptHour, settings.timeZone);
  const body = DAILY_PROMPTS[Math.floor(Math.random() * DAILY_PROMPTS.length)];

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerMs,
    repeatFrequency: RepeatFrequency.DAILY,
    alarmManager: { allowWhileIdle: true },
  };

  await notifee.createTriggerNotification(
    {
      id: NOTIFICATION_ID,
      title: 'Angelia',
      body,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_notification',
        pressAction: { id: 'default' },
      },
    },
    trigger,
  );
}

/**
 * Cancels the daily prompt notification if one is scheduled.
 */
export async function cancelDailyPrompt(): Promise<void> {
  await notifee.cancelNotification(NOTIFICATION_ID);
}
