import type * as Notifications from 'expo-notifications';
import { withNotificationsEntry } from '@/lib/navigation/entryNavigation.utils';

/**
 * Single source of truth for "which screen does tapping a push notification open?".
 *
 * Both the module-level response listener in `app/_layout.tsx` and the cold-start /
 * mounted listeners in `useDataListenerNotifications` used to carry their own copy of
 * this table, and the copies drifted apart. Keep every tap path going through here.
 */

export const NOTIFICATIONS_INBOX_PATH = '/(protected)/notifications';

export interface NotificationNavTarget {
  pathname: string;
  params?: Record<string, string>;
  /** When set, matching presented notifications are cleared from the tray once we route. */
  dismissFilter?: Record<string, string>;
}

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, string> = {};
  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entryValue === 'string') {
      out[key] = entryValue;
    } else if (typeof entryValue === 'number' || typeof entryValue === 'boolean') {
      out[key] = String(entryValue);
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Pulls the custom data keys out of a notification. iOS push notifications can
 * surface custom keys in `trigger.payload` instead of `content.data`.
 */
export function extractNotificationData(
  notification: Notifications.Notification,
): Record<string, string> | undefined {
  const contentData = toStringRecord(notification.request.content.data);
  if (contentData) {
    return contentData;
  }

  const triggerAny = notification.request.trigger as unknown as { payload?: unknown } | null;
  const payload = triggerAny?.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }

  // Common shapes: payload.data.{...} OR payload.{type, postId, ...}
  const payloadRecord = payload as Record<string, unknown>;
  return toStringRecord(payloadRecord.data) ?? toStringRecord(payloadRecord);
}

const inbox = (): NotificationNavTarget => {
  return { pathname: NOTIFICATIONS_INBOX_PATH };
};

/**
 * Maps a remote (FCM) notification's data payload to the screen it should open.
 *
 * - Returns `null` for types we do not know how to open (the tap just opens the app).
 * - When a known type arrives without the id it needs, falls back to the Notifications
 *   inbox rather than silently doing nothing.
 */
export function resolveRemoteNotificationTarget(
  data: Record<string, string> | undefined,
): NotificationNavTarget | null {
  const type = data?.type;
  if (!type) {
    return null;
  }

  switch (type) {
  case 'join_channel_request': {
    const id = data?.joinRequestId;
    return id
      ? { pathname: '/(protected)/join-request/[id]', params: withNotificationsEntry({ id }) }
      : inbox();
  }
  case 'join_channel_accepted':
    return {
      pathname: '/(protected)/channel-accepted',
      params: withNotificationsEntry({ channelName: data?.channelName ?? '' }),
    };
  case 'custom_circle_invite': {
    const id = data?.requestId;
    return id
      ? { pathname: '/(protected)/circle-invite/[id]', params: withNotificationsEntry({ id }) }
      : inbox();
  }
  case 'connection_request': {
    const id = data?.connectionRequestId;
    return id
      ? { pathname: '/(protected)/connection-request/[id]', params: withNotificationsEntry({ id }) }
      : inbox();
  }
  case 'connection_accepted':
    return { pathname: '/(protected)/my-people', params: withNotificationsEntry() };
  case 'new_post':
  case 'post_reaction': {
    const postId = data?.postId;
    return postId
      ? {
        pathname: '/(protected)/post/[id]',
        params: withNotificationsEntry({ id: postId }),
        dismissFilter: { type, postId },
      }
      : inbox();
  }
  case 'conversation_message':
  case 'comment_reply': {
    const postId = data?.postId;
    return postId
      ? {
        pathname: '/(protected)/conversation',
        params: withNotificationsEntry({ postId }),
        dismissFilter: { type, postId },
      }
      : inbox();
  }
  case 'private_note': {
    const postId = data?.postId;
    return postId
      ? {
        pathname: '/(protected)/private-notes-host/[postId]',
        params: withNotificationsEntry({ postId }),
        dismissFilter: { type, postId },
      }
      : inbox();
  }
  case 'private_note_reply': {
    const postId = data?.postId;
    const noteId = data?.noteId;
    return postId && noteId
      ? {
        pathname: '/(protected)/private-note-thread/[postId]/[noteId]',
        params: withNotificationsEntry({ postId, noteId }),
        dismissFilter: { type, postId, noteId },
      }
      : inbox();
  }
  default:
    return null;
  }
}
