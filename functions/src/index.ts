import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ── Types (mirrors src/models/types.ts in the app) ─────────────────────────

type AppNotificationType = 'join_channel_request' | 'join_channel_accepted';

interface BaseAppNotification {
  id: string;
  type: AppNotificationType;
  targetUserId: string;
  createdAt: number;
}

interface JoinChannelRequestNotification extends BaseAppNotification {
  type: 'join_channel_request';
  requesterId: string;
  requesterFirstName: string;
  requesterLastName: string;
  channelId: string;
  channelName: string;
  joinRequestId: string;
}

interface JoinChannelAcceptedNotification extends BaseAppNotification {
  type: 'join_channel_accepted';
  channelId: string;
  channelName: string;
  joinRequestId: string;
}

type AppNotification = JoinChannelRequestNotification | JoinChannelAcceptedNotification;

interface FcmTokenEntry {
  deviceId: string;
  token: string;
  deviceName?: string;
}

interface UserNotificationSettings {
  fcmTokens?: FcmTokenEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildFcmPayload(notification: AppNotification): {
  title: string;
  body: string;
  data: Record<string, string>;
} {
  if (notification.type === 'join_channel_request') {
    const n = notification as JoinChannelRequestNotification;
    return {
      title: 'New Join Request',
      body: `${n.requesterFirstName} ${n.requesterLastName} wants to join ${n.channelName}`,
      data: {
        type: n.type,
        channelId: n.channelId,
        channelName: n.channelName,
        joinRequestId: n.joinRequestId,
        requesterId: n.requesterId,
        requesterFirstName: n.requesterFirstName,
        requesterLastName: n.requesterLastName,
      },
    };
  }

  // join_channel_accepted
  const n = notification as JoinChannelAcceptedNotification;
  return {
    title: 'Request Accepted! 🎉',
    body: `You've been accepted into ${n.channelName}`,
    data: {
      type: n.type,
      channelId: n.channelId,
      channelName: n.channelName,
      joinRequestId: n.joinRequestId,
    },
  };
}

// ── Cloud Function ─────────────────────────────────────────────────────────

/**
 * Triggered when a new document is created in the `notifications` collection.
 * Fetches the target user's FCM tokens, sends the push notification to all
 * registered devices, then deletes the notification document.
 */
export const sendAppNotification = onDocumentCreated(
  'notifications/{notificationId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notification = snap.data() as AppNotification;

    // Fetch the target user's notification settings (contains FCM tokens)
    const settingsSnap = await db
      .collection('userNotificationSettings')
      .doc(notification.targetUserId)
      .get();

    if (!settingsSnap.exists) {
      // No settings document — nothing to send; clean up and exit
      await snap.ref.delete();
      return;
    }

    const settings = settingsSnap.data() as UserNotificationSettings;
    const tokens = (settings.fcmTokens ?? []).map((t) => t.token).filter(Boolean);

    if (tokens.length > 0) {
      const { title, body, data } = buildFcmPayload(notification);

      try {
        await messaging.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data,
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
            },
          },
        });
      } catch {
        // Delivery failure is best-effort; still delete the document below
      }
    }

    // Always delete the notification document after processing
    await snap.ref.delete();
  },
);
