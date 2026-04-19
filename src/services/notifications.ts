import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMessaging, requestPermission, getToken, deleteToken, AuthorizationStatus } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import type { FcmTokenEntry, NotificationSettings } from '@/models/types';
import { DEFAULT_WIND_DOWN_PROMPT } from '@/models/constants';
import { generateId } from '@/utils/generateId';

// ---- Constants ----

const CHANNEL_ID = 'daily-prompt';
export const NOTIFICATION_ID = 'daily-prompt';
export const WIND_DOWN_NOTIFICATION_ID = 'wind-down-prompt';

const DEVICE_ID_KEY = '@angelia/device_id';

// Each prompt has a notification body and a set of follow-up messages shown
// when the user taps the notification to open the post creation screen.
// Multiple follow-ups per prompt give variety across repeated presses.
export interface DailyPrompt {
  body: string;
  followUps: string[];
}

export const DAILY_PROMPTS: DailyPrompt[] = [
  {
    body: "What are you up to? People want to know. ✨",
    followUps: [
      "Ready to share? What's going on? ✨",
      "People are genuinely curious — drop a quick update! 👀",
      "Even one sentence works — what's happening? 💬",
    ],
  },
  {
    body: "Anything small worth sharing today? 💫",
    followUps: [
      "Something small is still something! What's on your mind? 💫",
      "The tiniest update counts — go ahead! 🌟",
      "No pressure, just vibes — what's up? ✌️",
    ],
  },
  {
    body: "A tiny life update still counts. 🌙",
    followUps: [
      "What's a little thing that happened today? 🌙",
      "Big or small, we want to hear it 💛",
      "Your people want to know — share away! 🫶",
    ],
  },
  {
    body: "Hey! What's been going on? 💛",
    followUps: [
      "Tell us something! Anything! 💛",
      "How's life treating you? Share a quick update 🌈",
      "We've been wondering about you — what's new? 👋",
    ],
  },
  {
    body: "Share something, anything — we're all ears. 🌟",
    followUps: [
      "Go ahead — say something! 🌟",
      "Your crew is listening — what's on your mind? 💬",
      "Just a few words is all it takes 🤗",
    ],
  },
];

export const WIND_DOWN_PROMPTS: DailyPrompt[] = [
  {
    body: "How was your day? Time to tell your people. 🌙",
    followUps: [
      "Time to wind down — how did today go? 🌙",
      "Your day's wrapping up — share the highlights! ✨",
      "Evening vibes — what was today like? 💛",
    ],
  },
  {
    body: "Day's done — share how it went! 🌟",
    followUps: [
      "How'd things go today? Even a sentence counts 🌟",
      "Wrap up your day with a quick update 💫",
      "Before you unwind — tell your crew how today was 🫶",
    ],
  },
  {
    body: "Winding down? Tell your people about your day. 💛",
    followUps: [
      "Cozy vibes only — how was your day? 💛",
      "Time to decompress — share a quick thought 🌙",
      "Your people are curious — what happened today? ✨",
    ],
  },
  {
    body: "End-of-day check-in — what's the vibe? 🫶",
    followUps: [
      "How are you feeling right now? Share with your crew 🫶",
      "Day in review — anything worth sharing? 🌈",
      "Last call for today — drop an update! 💬",
    ],
  },
];

/**
 * Returns a random follow-up message for the given prompt index.
 * Used to pre-fill the post creation screen when the notification is tapped.
 */
export function getFollowUpForPrompt(promptIndex: number): string {
  const prompt = DAILY_PROMPTS[promptIndex % DAILY_PROMPTS.length];
  return prompt.followUps[Math.floor(Math.random() * prompt.followUps.length)];
}

/**
 * Returns a random follow-up message for the given wind-down prompt index.
 */
export function getFollowUpForWindDown(promptIndex: number): string {
  const prompt = WIND_DOWN_PROMPTS[promptIndex % WIND_DOWN_PROMPTS.length];
  return prompt.followUps[Math.floor(Math.random() * prompt.followUps.length)];
}

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

// ---- Device identity ----

/**
 * Returns a stable per-device ID, creating and persisting one via AsyncStorage
 * on first call.  This ID is used to uniquely identify the device's FCM token
 * entry in Firestore so updates replace rather than accumulate.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = generateId('nano');
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // If AsyncStorage is unavailable return a session-only ID — the token will
    // be treated as a new device on every login which is better than failing.
    return generateId('nano');
  }
}

/**
 * Returns a human-friendly device name using expo-device (e.g. "iPhone 15 Pro").
 * Falls back to the model name or a generic string if unavailable.
 */
export function getDeviceName(): string {
  return Device.deviceName ?? Device.modelName ?? 'Unknown Device';
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
 * Requests both FCM (remote) and expo-notifications (local) permissions.
 * Returns true when the user grants permission.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const authStatus = await requestPermission(getMessaging());
  const fcmGranted =
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL;

  const permResponse = await Notifications.requestPermissionsAsync();
  const localGranted =
    (permResponse as unknown as { status: string }).status ===
    Notifications.PermissionStatus.GRANTED;

  return fcmGranted && localGranted;
}

// ---- FCM token ----

/**
 * Returns the current FCM registration token string, or null if unavailable.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    const token = await getToken(getMessaging());
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Invalidates the existing FCM registration token for this device and requests
 * a fresh one.  Attaches the stable device ID and a human-friendly device name
 * so the Firestore entry can be keyed by device rather than by token value.
 * Returns the full FcmTokenEntry, or null if the operation fails.
 */
export async function refreshFcmToken(): Promise<FcmTokenEntry | null> {
  try {
    await deleteToken(getMessaging());
    const token = await getToken(getMessaging());
    if (!token) return null;
    const deviceId = await getOrCreateDeviceId();
    const deviceName = getDeviceName();
    return { deviceId, token, deviceName };
  } catch {
    return null;
  }
}

/**
 * Deletes the local FCM registration token so a fresh one is issued on the
 * next sign-in.  Call this on sign-out.
 */
export async function deleteLocalFcmToken(): Promise<void> {
  try {
    await deleteToken(getMessaging());
  } catch {
    // Best-effort — failure here should not block sign-out
  }
}

// ---- Local notification scheduling ----

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily Prompts',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/**
 * Schedules (or reschedules) both the mid-day and wind-down prompt notifications.
 * Safe to call multiple times — it cancels any existing prompts first.
 * Stores the chosen promptIndex in the notification data so the press handler
 * can look up the appropriate follow-up messages.
 *
 * Uses a DailyTriggerInput so the notification fires every day at the
 * specified hour in the device's local timezone.
 */
export async function scheduleDailyPrompt(settings: NotificationSettings): Promise<void> {
  await cancelDailyPrompt();

  await ensureAndroidChannel();

  // Schedule mid-day check-in
  if (settings.dailyPrompt.enabled) {
    const promptIndex = Math.floor(Math.random() * DAILY_PROMPTS.length);
    const body = DAILY_PROMPTS[promptIndex].body;

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: 'Angelia',
        body,
        data: { promptIndex: String(promptIndex), type: 'midday' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.dailyPrompt.hour,
        minute: settings.dailyPrompt.minute ?? 0,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }

  // Schedule wind-down prompt
  const windDown = settings.windDownPrompt ?? { ...DEFAULT_WIND_DOWN_PROMPT, enabled: false };
  if (windDown.enabled) {
    const wdIndex = Math.floor(Math.random() * WIND_DOWN_PROMPTS.length);
    const wdBody = WIND_DOWN_PROMPTS[wdIndex].body;

    await Notifications.scheduleNotificationAsync({
      identifier: WIND_DOWN_NOTIFICATION_ID,
      content: {
        title: 'Angelia',
        body: wdBody,
        data: { promptIndex: String(wdIndex), type: 'winddown' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: windDown.hour,
        minute: windDown.minute ?? 30,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
}

/**
 * Cancels both daily prompt notifications if scheduled.
 */
export async function cancelDailyPrompt(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  await Notifications.cancelScheduledNotificationAsync(WIND_DOWN_NOTIFICATION_ID);
}
