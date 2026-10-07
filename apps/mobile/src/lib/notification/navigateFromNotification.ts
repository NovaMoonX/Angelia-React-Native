import { router } from 'expo-router';
import {
  NOTIFICATION_ID,
  WIND_DOWN_NOTIFICATION_ID,
  dismissNotificationsByData,
  getFollowUpForPrompt,
  getFollowUpForWindDown,
} from '@/services/notifications';
import {
  resolveRemoteNotificationTarget,
  type NotificationNavTarget,
} from '@/lib/notification/notificationRouting';

/** Local daily prompt / wind-down reminders: open post creation with the follow-up banner. */
function resolveDailyPromptTarget(
  identifier: string,
  data: Record<string, string> | undefined,
): NotificationNavTarget | null {
  if (identifier !== NOTIFICATION_ID && identifier !== WIND_DOWN_NOTIFICATION_ID) {
    return null;
  }

  const promptIndex = Number(data?.promptIndex ?? '0') || 0;
  const followUp = identifier === WIND_DOWN_NOTIFICATION_ID
    ? getFollowUpForWindDown(promptIndex)
    : getFollowUpForPrompt(promptIndex);

  return {
    pathname: '/(protected)/post/new',
    // `notificationPrompt` renders as a banner above the composer. Do NOT use
    // `existingText` here — that pre-fills the user's draft with the prompt copy.
    params: { notificationPrompt: followUp },
  };
}

/**
 * Opens the screen for a tapped notification (local daily prompt or remote push).
 * Returns `true` when a route was pushed. Throws if the navigator is not ready yet,
 * so callers can retry (see `pushRouteWhenNavigatorReady`).
 */
export function navigateFromNotification(
  identifier: string,
  data: Record<string, string> | undefined,
): boolean {
  const target = resolveDailyPromptTarget(identifier, data)
    ?? resolveRemoteNotificationTarget(data);

  if (!target) {
    return false;
  }

  if (target.dismissFilter) {
    void dismissNotificationsByData(target.dismissFilter).catch(() => {
      return null;
    });
  }

  if (target.params) {
    router.push({ pathname: target.pathname, params: target.params } as never);
  } else {
    router.push(target.pathname as never);
  }

  return true;
}
