import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

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
  | 'big_news_post'
  | 'new_post'
  | 'comment_reply'
  | 'private_note';

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

/** Mirrors BigNewsPostNotification in src/models/types.ts — keep in sync. */
interface BigNewsPostNotification extends BaseAppNotification {
  type: 'big_news_post';
  postId: string;
  channelId: string;
  channelName: string;
  isDaily: boolean;
  authorFirstName: string;
  authorLastName: string;
}

/** Mirrors PrivateNoteNotification in src/models/types.ts — keep in sync. */
interface PrivateNoteNotification extends BaseAppNotification {
  type: 'private_note';
  postId: string;
  authorFirstName: string;
  authorLastName: string;
}

type AppNotification =
  | JoinChannelRequestNotification
  | JoinChannelAcceptedNotification
  | ConnectionRequestNotification
  | ConnectionAcceptedNotification
  | BigNewsPostNotification
  | PrivateNoteNotification;

interface ConnectionRequest {
  id: string;
  fromId: string;
  toId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  respondedAt: number | null;
}

/** Mirrors ChannelJoinRequest in src/models/types.ts — keep in sync. */
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

/** Mirrors Channel in src/models/types.ts — keep in sync. */
interface Channel {
  id: string;
  ownerId: string;
  subscribers: string[];
  isDaily: boolean | null;
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

  if (notification.type === 'big_news_post') {
    const n = notification as BigNewsPostNotification;
    const circleLabel = n.isDaily ? 'Daily Circle' : `"${n.channelName}"`;
    return {
      title: '🔔 Big News!!',
      body: `${n.authorFirstName} ${n.authorLastName} shared big news in their ${circleLabel}`,
      data: {
        type: n.type,
        postId: n.postId,
        channelId: n.channelId,
        channelName: n.channelName,
        isDaily: String(n.isDaily),
        authorFirstName: n.authorFirstName,
        authorLastName: n.authorLastName,
      },
    };
  }

  if (notification.type === 'private_note') {
    const n = notification as PrivateNoteNotification;
    return {
      title: '🔒 Private Note',
      body: `${n.authorFirstName} ${n.authorLastName} sent you a private note`,
      data: {
        type: n.type,
        postId: n.postId,
        authorFirstName: n.authorFirstName,
        authorLastName: n.authorLastName,
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

/**
 * Sends an FCM multicast to all provided tokens with the given payload.
 * Failure is best-effort — individual token failures are swallowed.
 */
async function sendFcmToTokens(
  tokens: string[],
  payload: { title: string; body: string; data: Record<string, string> },
): Promise<void> {
  if (tokens.length === 0) return;
  const { title, body, data } = payload;
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
    // Delivery failure is best-effort
  }
}

/**
 * Fetches all FCM tokens for a single user from `userNotificationSettings/{uid}`.
 * Returns an empty array when the document does not exist.
 */
async function getTokensForUser(userId: string): Promise<string[]> {
  const snap = await db.collection('userNotificationSettings').doc(userId).get();
  if (!snap.exists) return [];
  const settings = snap.data() as UserNotificationSettings;
  return (settings.fcmTokens ?? []).map((t) => t.token).filter(Boolean);
}

/**
 * Triggered when a new document is created in the `notifications` collection.
 * Fetches the target user's (or channel's subscribers') FCM tokens, sends the
 * push notification to all registered devices, then deletes the notification document.
 *
 * Supported targets:
 *   - `user`         — a single specific user (existing behaviour)
 *   - `channel_tier` — all subscribers of a channel, e.g. for big-news posts
 */
export const sendAppNotification = onDocumentCreated(
  'notifications/{notificationId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notification = snap.data() as AppNotification;
    const payload = buildFcmPayload(notification);

    if (notification.target.type === 'user') {
      // ── Single-user target ─────────────────────────────────────────────
      const tokens = await getTokensForUser(notification.target.userId);
      await sendFcmToTokens(tokens, payload);
    } else if (notification.target.type === 'channel_tier') {
      // ── Channel-tier target: fan-out to all channel subscribers ────────
      const channelSnap = await db
        .collection('channels')
        .doc(notification.target.channelId)
        .get();

      if (!channelSnap.exists) {
        await snap.ref.delete();
        return;
      }

      const channel = channelSnap.data() as Channel;
      // Notify all subscribers; exclude the post author (actorId) to avoid
      // sending a push to the person who just posted.
      const recipientIds = channel.subscribers.filter(
        (id) => id !== notification.actorId,
      );

      // Fan-out: fetch tokens for all recipients in parallel, then batch-send.
      const tokenArrays = await Promise.all(recipientIds.map(getTokensForUser));
      const allTokens = tokenArrays.flat();
      await sendFcmToTokens(allTokens, payload);
    } else {
      // `thread` targets and any future unrecognised target types are not yet
      // supported.  Fall through to deletion so the document is cleaned up.
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

// ── Cloud Function: Delete expired posts every 24 hours ────────────────────

/**
 * Daily retention policy:
 *   - Posts in a Daily Circle expire after 14 days.
 *   - Posts in a Custom Circle expire after 3 months (90 days).
 *
 * Runs once every 24 hours. Queries all posts older than 14 days (the shorter
 * cutoff), then deletes them if the post's channel is a Daily Circle, or if
 * the post is older than 90 days for a Custom Circle.
 */
const DAILY_POST_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;   // 14 days
const CUSTOM_POST_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;  // 90 days (~3 months)

export const deleteExpiredPosts = onSchedule('every 24 hours', async () => {
  const now = Date.now();
  const dailyCutoff = now - DAILY_POST_RETENTION_MS;
  const customCutoff = now - CUSTOM_POST_RETENTION_MS;

  // Build a channelId → isDaily map from all channel documents.
  const channelsSnap = await db.collection('channels').select('isDaily').get();
  const channelIsDaily = new Map<string, boolean>();
  for (const doc of channelsSnap.docs) {
    channelIsDaily.set(doc.id, doc.data().isDaily === true);
  }

  // Fetch all posts older than the shortest retention window (14 days).
  // Posts between 14 and 90 days old will be filtered further below.
  const oldPostsSnap = await db
    .collection('posts')
    .where('timestamp', '<', dailyCutoff)
    .get();

  const toDelete: admin.firestore.DocumentReference[] = [];
  for (const doc of oldPostsSnap.docs) {
    const data = doc.data() as { channelId?: string; timestamp?: number };
    const { channelId, timestamp } = data;
    if (typeof channelId !== 'string' || typeof timestamp !== 'number') continue;
    const isDaily = channelIsDaily.get(channelId) ?? false;
    if (isDaily || timestamp < customCutoff) {
      toDelete.push(doc.ref);
    }
  }

  // Delete all Storage media files for each expired post (best-effort).
  // Post media is stored under posts/{postId}/ in the default bucket.
  const bucket = admin.storage().bucket();
  await Promise.all(
    toDelete.map(async (ref) => {
      try {
        await bucket.deleteFiles({ prefix: `posts/${ref.id}/` });
      } catch (err) {
        // Best-effort: a storage failure should not block Firestore cleanup.
        console.error(`Failed to delete Storage files for post ${ref.id}:`, err);
      }
    }),
  );

  // Firestore batches are limited to 500 operations each.
  const BATCH_SIZE = 500;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of toDelete.slice(i, i + BATCH_SIZE)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
});
