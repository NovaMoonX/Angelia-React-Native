import * as Notifications from 'expo-notifications';
import { getMessaging, requestPermission, getToken, deleteToken, AuthorizationStatus } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import type { NotificationSettings } from '@/models/types';

// ---- Constants ----

const CHANNEL_ID = 'daily-prompt';
export const NOTIFICATION_ID = 'daily-prompt';

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

/**
 * Returns a random follow-up message for the given prompt index.
 * Used to pre-fill the post creation screen when the notification is tapped.
 */
export function getFollowUpForPrompt(promptIndex: number): string {
  const prompt = DAILY_PROMPTS[promptIndex % DAILY_PROMPTS.length];
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
 * Returns the current FCM registration token, or null if unavailable.
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
 * a fresh one.  Call this on every sign-in so each session uses a known-good
 * token.  Returns the new token, or null if the operation fails.
 */
export async function refreshFcmToken(): Promise<string | null> {
  try {
    await deleteToken(getMessaging());
    const token = await getToken(getMessaging());
    return token || null;
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
 * Schedules (or reschedules) the daily prompt notification based on current settings.
 * Safe to call multiple times — it cancels any existing daily prompt first.
 * Stores the chosen promptIndex in the notification data so the press handler
 * can look up the appropriate follow-up messages.
 *
 * Uses a DailyTriggerInput so the notification fires every day at the
 * specified hour in the device's local timezone.
 */
export async function scheduleDailyPrompt(settings: NotificationSettings): Promise<void> {
  await cancelDailyPrompt();

  if (!settings.dailyPromptEnabled) return;

  await ensureAndroidChannel();

  const promptIndex = Math.floor(Math.random() * DAILY_PROMPTS.length);
  const body = DAILY_PROMPTS[promptIndex].body;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: 'Angelia',
      body,
      data: { promptIndex: String(promptIndex) },
      // sound is applied via the notification channel on Android; this
      // field ensures the default sound plays on iOS.
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.dailyPromptHour,
      minute: settings.dailyPromptMinute ?? 0,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });
}

/**
 * Cancels the daily prompt notification if one is scheduled.
 */
export async function cancelDailyPrompt(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
}
