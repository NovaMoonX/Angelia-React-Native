import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/** Mirrors DAILY_CHANNEL_SUFFIX in src/models/constants.ts — keep in sync. */
const DAILY_CHANNEL_SUFFIX = '-daily';

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
  note: string | null;
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

/** Mirrors the public profile fields stored at usersPublic/{uid}. */
interface UserPublic {
  id: string;
  firstName: string;
  lastName: string;
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
    const res = await messaging.sendEachForMulticast({
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
    if (res.failureCount > 0) {
      res.responses.forEach((r, idx) => {
        if (!r.success) {
          console.error(`Failed to send FCM to token ${tokens[idx]}:`, r.error);
        }
      });
    } else {
      console.log(`Successfully sent FCM to ${tokens.length} tokens`);
    }
  } catch (err) {
    console.error('FCM send error:', err);
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
 *   - `user`         — a single specific user (existing behavior)
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
      // `thread` targets and any future unrecognized target types are not yet
      // supported.  Fall through to deletion so the document is cleaned up.
    }

    // Always delete the notification document after processing
    await snap.ref.delete();
  },
);

// ── Cloud Function: Create mutual connection on request acceptance ──────────

/**
 * Triggered when a `connectionRequests` document is updated.
 * When the status changes to 'accepted':
 *   1. Writes mutual connection documents for both parties.
 *   2. Adds each user to the other's daily circle as a subscriber, so the
 *      standard channel subscription automatically includes each other's feed.
 *   3. Sends a `connection_accepted` push notification to the original requester.
 *
 * All writes are batched for atomicity. The idempotency guard on
 * `before.status` prevents duplicate work if the function is retried.
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
    const requestId = event.params.requestId;
    const connectedAt = Date.now();

    // Fetch the acceptor's public profile for the notification payload.
    const toUserSnap = await db.collection('usersPublic').doc(toId).get();
    const toUser = toUserSnap.exists ? (toUserSnap.data() as UserPublic) : null;

    // 1. Commit the mutual connection documents and notification atomically.
    //    These are the core of the operation and must succeed together.
    const connectionBatch = db.batch();

    connectionBatch.set(
      db.collection('connections').doc(fromId).collection('people').doc(toId),
      { userId: toId, connectedAt },
    );
    connectionBatch.set(
      db.collection('connections').doc(toId).collection('people').doc(fromId),
      { userId: fromId, connectedAt },
    );

    if (toUser) {
      const notifRef = db.collection('notifications').doc();
      connectionBatch.set(notifRef, {
        id: notifRef.id,
        type: 'connection_accepted',
        actorId: toId,
        target: { type: 'user', userId: fromId },
        toFirstName: toUser.firstName,
        toLastName: toUser.lastName,
        connectionRequestId: requestId,
        createdAt: connectedAt,
      });
    }

    await connectionBatch.commit();

    // 2. Add each user as a subscriber in the other's daily circle so that the
    //    regular channel subscription delivers each other's feed automatically.
    //    This runs separately so a missing daily channel document (edge case)
    //    does not roll back the connection and notification committed above.
    try {
      const circlesBatch = db.batch();
      circlesBatch.update(
        db.collection('channels').doc(`${toId}${DAILY_CHANNEL_SUFFIX}`),
        { subscribers: FieldValue.arrayUnion(fromId) },
      );
      circlesBatch.update(
        db.collection('channels').doc(`${fromId}${DAILY_CHANNEL_SUFFIX}`),
        { subscribers: FieldValue.arrayUnion(toId) },
      );
      await circlesBatch.commit();
    } catch (err) {
      console.error(`onConnectionRequestAccepted: failed to update daily circle subscribers for ${fromId} ↔ ${toId}:`, err);
    }
  },
);

// ── Cloud Function: Create mutual connection when a circle join is accepted ─

/**
 * Triggered when a `channelJoinRequests` document is updated.
 * When the status changes to 'accepted':
 *   1. Writes mutual connection documents for the requester and the circle owner.
 *   2. Adds each user as a subscriber in the other's daily circle so their feeds
 *      are visible without a separate connection request.
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

    // 1. Commit the mutual connection documents atomically.
    const connectionBatch = db.batch();

    connectionBatch.set(
      db.collection('connections').doc(requesterId).collection('people').doc(channelOwnerId),
      { userId: channelOwnerId, connectedAt },
    );
    connectionBatch.set(
      db.collection('connections').doc(channelOwnerId).collection('people').doc(requesterId),
      { userId: requesterId, connectedAt },
    );

    await connectionBatch.commit();

    // 2. Add each user as a subscriber in the other's daily circle.
    //    Runs separately so a missing daily channel document (edge case)
    //    does not roll back the connection committed above.
    try {
      const circlesBatch = db.batch();
      circlesBatch.update(
        db.collection('channels').doc(`${channelOwnerId}${DAILY_CHANNEL_SUFFIX}`),
        { subscribers: FieldValue.arrayUnion(requesterId) },
      );
      circlesBatch.update(
        db.collection('channels').doc(`${requesterId}${DAILY_CHANNEL_SUFFIX}`),
        { subscribers: FieldValue.arrayUnion(channelOwnerId) },
      );
      await circlesBatch.commit();
    } catch (err) {
      console.error(`onJoinRequestAccepted: failed to update daily circle subscribers for ${requesterId} ↔ ${channelOwnerId}:`, err);
    }
  },
);

// ── Cloud Function: Disconnect two users ──────────────────────────────────

/**
 * Written by the client to `disconnectRequests/{requestId}` to kick off a
 * server-side disconnect.  Firestore rules ensure only the requester can create
 * the document.
 */
interface DisconnectRequest {
  requesterId: string;
  targetUserId: string;
  createdAt: number;
}

/**
 * Triggered when a `disconnectRequests` document is created.
 *
 * In a single Firestore batch it:
 *   1. Deletes the mutual connection documents for both parties.
 *   2. Removes the target user from every channel owned by the requester
 *      where the target is currently a subscriber (including their daily circle).
 *   3. Removes the requester from the target's daily circle.
 *
 * Using a single batch keeps costs low (one Admin SDK round-trip) and makes
 * the operation atomic from the Cloud Function's perspective.
 */
export const onDisconnectRequest = onDocumentCreated(
  'disconnectRequests/{requestId}',
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { requesterId, targetUserId } = snap.data() as DisconnectRequest;
    if (!requesterId || !targetUserId) {
      await snap.ref.delete();
      return;
    }

    const batch = db.batch();

    // 1. Remove both sides of the connection.
    batch.delete(
      db.collection('connections').doc(requesterId).collection('people').doc(targetUserId),
    );
    batch.delete(
      db.collection('connections').doc(targetUserId).collection('people').doc(requesterId),
    );

    // 2. Remove the target from every channel owned by the requester where
    //    they are listed as a subscriber (covers the requester's daily circle
    //    and any custom circles they own).
    const channelsSnap = await db
      .collection('channels')
      .where('ownerId', '==', requesterId)
      .where('subscribers', 'array-contains', targetUserId)
      .get();

    for (const channelDoc of channelsSnap.docs) {
      batch.update(channelDoc.ref, {
        subscribers: FieldValue.arrayRemove(targetUserId),
      });
    }

    // 3. Remove the requester from the target's daily circle.
    batch.update(
      db.collection('channels').doc(`${targetUserId}${DAILY_CHANNEL_SUFFIX}`),
      { subscribers: FieldValue.arrayRemove(requesterId) },
    );

    // 4. Clean up the request document.
    batch.delete(snap.ref);

    await batch.commit();
  },
);

// ── Cloud Function: Cascade-delete circles marked for deletion ─────────────

/**
 * Runs once every 24 hours (UTC midnight) and permanently removes any circle
 * (custom channel) that has been marked for deletion by its owner.
 *
 * Deletion order (to satisfy the constraint that a circle is only removed once
 * all related data is gone):
 *   1. Delete Firebase Storage media files for every post in the channel.
 *   2. Recursively delete every post document (which also removes the
 *      `messages`, `comments`, and `privateNotes` subcollections).
 *   3. Delete all `channelJoinRequests` documents for the channel.
 *   4. Delete the channel document itself.
 *
 * Each channel is processed independently so a failure on one does not block
 * the others.
 */
const DELETE_BATCH_SIZE = 500;

export const deleteMarkedChannels = onSchedule('every 24 hours', async () => {
  const channelsSnap = await db
    .collection('channels')
    .where('markedForDeletionAt', '!=', null)
    .get();

  if (channelsSnap.empty) return;

  const bucket = admin.storage().bucket();

  for (const channelDoc of channelsSnap.docs) {
    const channelId = channelDoc.id;
    console.log(`deleteMarkedChannels: starting cleanup for channel ${channelId}`);

    try {
      // ── Step 1 & 2: Collect all posts, delete Storage media, then delete docs ─
      const postsSnap = await db
        .collection('posts')
        .where('channelId', '==', channelId)
        .get();

      // Delete Storage files for all posts in parallel (best-effort).
      await Promise.all(
        postsSnap.docs.map(async (postDoc) => {
          try {
            await bucket.deleteFiles({ prefix: `posts/${postDoc.id}/` });
          } catch (err) {
            console.error(
              `deleteMarkedChannels: failed to delete Storage files for post ${postDoc.id}:`,
              err,
            );
          }
        }),
      );

      // Recursively delete each post document (removes messages/comments/privateNotes subcollections).
      for (const postDoc of postsSnap.docs) {
        try {
          await db.recursiveDelete(postDoc.ref);
        } catch (err) {
          console.error(
            `deleteMarkedChannels: failed to recursively delete post ${postDoc.id}:`,
            err,
          );
        }
      }

      // ── Step 3: Delete channelJoinRequests for this channel ───────────────────
      const joinRequestsSnap = await db
        .collection('channelJoinRequests')
        .where('channelId', '==', channelId)
        .get();

      const joinRequestRefs = joinRequestsSnap.docs.map((d) => d.ref);
      for (let i = 0; i < joinRequestRefs.length; i += DELETE_BATCH_SIZE) {
        const batch = db.batch();
        for (const ref of joinRequestRefs.slice(i, i + DELETE_BATCH_SIZE)) {
          batch.delete(ref);
        }
        await batch.commit();
      }

      // ── Step 4: Delete the channel document itself ────────────────────────────
      await channelDoc.ref.delete();

      console.log(
        `deleteMarkedChannels: successfully deleted channel ${channelId} ` +
        `(${postsSnap.size} posts, ${joinRequestsSnap.size} join requests)`,
      );
    } catch (err) {
      console.error(`deleteMarkedChannels: unexpected error processing channel ${channelId}:`, err);
    }
  }
});

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
