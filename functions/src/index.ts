import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ── Types (mirrors src/models/types.ts in the app) ─────────────────────────
// IMPORTANT: Keep these types in sync with src/models/types.ts in the app.

type AppNotificationType =
  | 'join_channel_request'
  | 'join_channel_accepted'
  | 'connection_request'
  | 'connection_accepted'
  | 'new_post'
  | 'comment_reply';

type PostTier = 'everyday' | 'worth-knowing' | 'big-news';

type NotificationTarget =
  | { type: 'user'; userId: string }
  | { type: 'channel_tier'; channelId: string; tier: PostTier }
  | { type: 'thread'; threadId: string };

interface BaseAppNotification {
  id: string;
  type: AppNotificationType;
  actorId: string;
  target: NotificationTarget;
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

interface ConnectionRequestNotification extends BaseAppNotification {
  type: 'connection_request';
  fromId: string;
  fromFirstName: string;
  fromLastName: string;
  connectionRequestId: string;
}

interface ConnectionAcceptedNotification extends BaseAppNotification {
  type: 'connection_accepted';
  toFirstName: string;
  toLastName: string;
  connectionRequestId: string;
}

type AppNotification =
  | JoinChannelRequestNotification
  | JoinChannelAcceptedNotification
  | ConnectionRequestNotification
  | ConnectionAcceptedNotification;

interface ConnectionRequest {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt: number | null;
}

interface ChannelJoinRequest {
  id: string;
  channelId: string;
  channelOwnerId: string;
  requesterId: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt: number | null;
}

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

  if (notification.type === 'join_channel_accepted') {
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

  if (notification.type === 'connection_request') {
    const n = notification as ConnectionRequestNotification;
    return {
      title: '🤝 Connection Request',
      body: `${n.fromFirstName} ${n.fromLastName} wants to connect with you`,
      data: {
        type: n.type,
        fromId: n.fromId,
        fromFirstName: n.fromFirstName,
        fromLastName: n.fromLastName,
        connectionRequestId: n.connectionRequestId,
      },
    };
  }

  // connection_accepted
  const n = notification as ConnectionAcceptedNotification;
  return {
    title: `🎉 You're connected!`,
    body: `${n.toFirstName} ${n.toLastName} accepted your connection request`,
    data: {
      type: n.type,
      toFirstName: n.toFirstName,
      toLastName: n.toLastName,
      connectionRequestId: n.connectionRequestId,
    },
  };
}

// ── Cloud Function: Send FCM on new notification doc ───────────────────────

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

    // Only handle user-targeted notifications for now.
    // channel_tier and thread targets will be supported in future Cloud Functions.
    if (notification.target.type !== 'user') {
      await snap.ref.delete();
      return;
    }

    const targetUserId = notification.target.userId;

    // Fetch the target user's notification settings (contains FCM tokens)
    const settingsSnap = await db
      .collection('userNotificationSettings')
      .doc(targetUserId)
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

// ── Cloud Function: Create mutual connection on request acceptance ──────────

/**
 * Triggered when a `connectionRequests` document is updated.
 * When the status changes to 'accepted', writes mutual connection documents
 * under `connections/{userId}/people/{connectedUserId}` for both parties.
 * These writes use the Admin SDK and cannot be replicated by clients.
 */
export const onConnectionRequestAccepted = onDocumentUpdated(
  'connectionRequests/{requestId}',
  async (event) => {
    const before = event.data?.before.data() as ConnectionRequest | undefined;
    const after = event.data?.after.data() as ConnectionRequest | undefined;

    if (!before || !after) return;

    // Only act when status transitions from non-accepted to accepted.
    // Checking `before.status === 'accepted'` makes this idempotent: if the
    // Cloud Function is retried (e.g. after a transient failure), the second
    // execution will see `before.status === 'accepted'` and exit early,
    // preventing duplicate writes to the connections subcollection.
    if (before.status === 'accepted' || after.status !== 'accepted') return;

    const { fromId, toId } = after;
    const connectedAt = Date.now();

    const batch = db.batch();

    // fromId → toId
    batch.set(
      db.collection('connections').doc(fromId).collection('people').doc(toId),
      { userId: toId, connectedAt },
    );

    // toId → fromId
    batch.set(
      db.collection('connections').doc(toId).collection('people').doc(fromId),
      { userId: fromId, connectedAt },
    );

    await batch.commit();
  },
);

// ── Cloud Function: Create mutual connection when a circle join is accepted ─

/**
 * Triggered when a `channelJoinRequests` document is updated.
 * When the status changes to 'accepted', writes mutual connection documents
 * under `connections/{userId}/people/{connectedUserId}` for both the requester
 * and the circle owner.
 *
 * This means joining a circle automatically creates a direct connection between
 * the new member and the circle host, giving both parties access to each other's
 * Daily Circle without a separate connection request.
 *
 * The write is idempotent: if `before.status` is already 'accepted', the
 * function exits early so retries do not produce duplicate documents.
 */
export const onJoinRequestAccepted = onDocumentUpdated(
  'channelJoinRequests/{requestId}',
  async (event) => {
    const before = event.data?.before.data() as ChannelJoinRequest | undefined;
    const after = event.data?.after.data() as ChannelJoinRequest | undefined;

    if (!before || !after) return;

    // Only act when status transitions to 'accepted' for the first time.
    if (before.status === 'accepted' || after.status !== 'accepted') return;

    const { requesterId, channelOwnerId } = after;
    const connectedAt = Date.now();

    const batch = db.batch();

    // requester → channelOwner
    batch.set(
      db.collection('connections').doc(requesterId).collection('people').doc(channelOwnerId),
      { userId: channelOwnerId, connectedAt },
    );

    // channelOwner → requester
    batch.set(
      db.collection('connections').doc(channelOwnerId).collection('people').doc(requesterId),
      { userId: requesterId, connectedAt },
    );

    await batch.commit();
  },
);
