import { router } from 'expo-router';

export const ENTRY_FROM_NOTIFICATIONS = 'notifications';
export const ENTRY_FROM_POST_ACTIVITY = 'post-activity';

export function normalizeEntryFrom(from: string | string[] | undefined): string | undefined {
  if (Array.isArray(from)) {
    return from[0];
  }
  return from;
}

export function isFromNotifications(from: string | string[] | undefined): boolean {
  return normalizeEntryFrom(from) === ENTRY_FROM_NOTIFICATIONS;
}

export function withNotificationsEntry(
  params: Record<string, string> = {},
): Record<string, string> {
  return {
    ...params,
    from: ENTRY_FROM_NOTIFICATIONS,
  };
}

export function navigateBackFromEntry(from: string | string[] | undefined): void {
  const entryFrom = normalizeEntryFrom(from);

  if (entryFrom === ENTRY_FROM_NOTIFICATIONS) {
    router.dismissTo('/(protected)/notifications');
    return;
  }

  if (entryFrom === ENTRY_FROM_POST_ACTIVITY) {
    router.back();
    return;
  }

  router.dismissTo('/(protected)/feed');
}
