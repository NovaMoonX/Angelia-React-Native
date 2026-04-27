import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  onSnapshot,
  query,
  where,
  limit,
  orderBy,
  arrayUnion,
  arrayRemove,
} from '@react-native-firebase/firestore';
import type { User, UserPublic, UserPrivate, UserSecret, Channel, Post, NewUser, NewChannel, ChannelJoinRequest, UpdateUserProfileData, UserStatus, FcmTokenEntry, NotificationSettings, NotificationSettingsUpdate, Message, AppNotification, Connection, ConnectionRequest, FeedbackSubmission, AppTask, Comment, PrivateNote } from '@/models/types';
import { DAILY_CHANNEL_SUFFIX, DEFAULT_WIND_DOWN_PROMPT } from '@/models/constants';
import { generateId } from '@/utils/generateId';

const db = getFirestore();

// ---- User Operations ----

/**
 * Safe defaults for UserSecret fields when the secret document is unavailable
 * (e.g. when loading another user's public/private data only).
 */
const DEFAULT_USER_SECRET: UserSecret = {
  accountProgress: {
    signUpComplete: true,
    emailVerified: true,
    dailyChannelCreated: true,
  },
  customChannelCount: 0,
};

/** Merges the three user sub-documents into a single User object. */
function mergeUserDocs(
  pub: UserPublic,
  priv: UserPrivate | null,
  secret: UserSecret | null,
): User {
  return {
    ...pub,
    email: priv?.email ?? '',
    funFact: priv?.funFact ?? '',
    status: priv?.status ?? null,
    ...(secret ?? DEFAULT_USER_SECRET),
  };
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const [pubSnap, privSnap, secSnap] = await Promise.all([
    getDoc(doc(db, 'usersPublic', uid)),
    getDoc(doc(db, 'usersPrivate', uid)),
    getDoc(doc(db, 'usersSecret', uid)),
  ]);
  if (!pubSnap.exists) return null;
  return mergeUserDocs(
    pubSnap.data() as UserPublic,
    privSnap.exists ? (privSnap.data() as UserPrivate) : null,
    secSnap.exists ? (secSnap.data() as UserSecret) : null,
  );
}

export async function createUserProfile(userData: NewUser): Promise<void> {
  const now = Date.now();
  const publicData: UserPublic = {
    id: userData.id,
    firstName: userData.firstName,
    lastName: userData.lastName,
    avatar: userData.avatar,
    avatarUrl: userData.avatarUrl,
    joinedAt: now,
  };
  const privateData: UserPrivate = {
    email: userData.email,
    funFact: userData.funFact,
    status: null,
  };
  const secretData: UserSecret = {
    accountProgress: {
      signUpComplete: true,
      emailVerified: false,
      dailyChannelCreated: false,
    },
    customChannelCount: 0,
  };
  await Promise.all([
    setDoc(doc(db, 'usersPublic', userData.id), publicData),
    setDoc(doc(db, 'usersPrivate', userData.id), privateData),
    setDoc(doc(db, 'usersSecret', userData.id), secretData),
  ]);
}

export async function updateUserProfile(uid: string, data: UpdateUserProfileData): Promise<void> {
  const { funFact, ...publicFields } = data;
  const updates: Promise<void>[] = [
    updateDoc(doc(db, 'usersPublic', uid), publicFields),
  ];
  // Only write to usersPrivate when funFact is explicitly provided.
  if (funFact !== undefined) {
    updates.push(updateDoc(doc(db, 'usersPrivate', uid), { funFact }));
  }
  await Promise.all(updates);
}

export async function updateAccountProgress(
  uid: string,
  field: string,
  value: boolean
): Promise<void> {
  await updateDoc(doc(db, 'usersSecret', uid), {
    [`accountProgress.${field}`]: value,
  });
}

export async function updateUserStatus(uid: string, status: UserStatus | null): Promise<void> {
  await updateDoc(doc(db, 'usersPrivate', uid), { status });
}

// ---- Notification Settings Operations ----

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  fcmTokens: [],
  dailyPrompt: {
    enabled: true,
    hour: 12,
    minute: 0,
  },
  windDownPrompt: { ...DEFAULT_WIND_DOWN_PROMPT },
  timeZone: 'UTC',
  autoDetectTimeZone: true,
};

export async function getNotificationSettings(uid: string): Promise<NotificationSettings | null> {
  const snap = await getDoc(doc(db, 'userNotificationSettings', uid));
  return snap?.exists ? (snap.data() as NotificationSettings) : null;
}

export async function initNotificationSettings(
  uid: string,
  deviceTimeZone: string,
): Promise<NotificationSettings> {
  const settings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    timeZone: deviceTimeZone,
  };
  await setDoc(doc(db, 'userNotificationSettings', uid), settings);
  return settings;
}

export async function updateNotificationSettings(
  uid: string,
  data: NotificationSettingsUpdate,
): Promise<void> {
  // Flatten nested objects to Firestore dot-notation keys so partial updates
  // of nested fields (e.g. dailyPrompt.enabled) don't overwrite siblings.
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        flat[`${key}.${nestedKey}`] = nestedValue;
      }
    } else {
      flat[key] = value;
    }
  }
  await updateDoc(doc(db, 'userNotificationSettings', uid), flat);
}

/**
 * Inserts or replaces the FCM token entry for this device (keyed by deviceId).
 * This ensures each device has exactly one entry regardless of how many times
 * the user signs in, solving token accumulation on repeated logins.
 */
export async function upsertFcmToken(uid: string, entry: FcmTokenEntry): Promise<void> {
  const docRef = doc(db, 'userNotificationSettings', uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) return;
    const data = snap.data() as NotificationSettings;
    const tokens = (data.fcmTokens ?? []).filter((t) => t.deviceId !== entry.deviceId);
    tokens.push(entry);
    transaction.update(docRef, { fcmTokens: tokens });
  });
}

/**
 * Removes the FCM token entry for the given deviceId.
 */
export async function removeFcmToken(uid: string, deviceId: string): Promise<void> {
  const docRef = doc(db, 'userNotificationSettings', uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) return;
    const data = snap.data() as NotificationSettings;
    const tokens = (data.fcmTokens ?? []).filter((t) => t.deviceId !== deviceId);
    transaction.update(docRef, { fcmTokens: tokens });
  });
}

export function subscribeToNotificationSettings(
  uid: string,
  callback: (settings: NotificationSettings | null) => void,
): () => void {
  return onSnapshot(doc(db, 'userNotificationSettings', uid), (snap) => {
    if (!snap) return;
    callback(snap.exists ? (snap.data() as NotificationSettings) : null);
  });
}

// ---- Channel Operations ----

export async function getChannel(channelId: string): Promise<Channel | null> {
  const snap = await getDoc(doc(db, 'channels', channelId));
  return snap.exists ? (snap.data() as Channel) : null;
}

export async function getChannelByInviteCode(inviteCode: string): Promise<Channel | null> {
  const snap = await getDocs(
    query(
      collection(db, 'channels'),
      where('inviteCode', '==', inviteCode),
      where('markedForDeletionAt', '==', null),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as Channel;
}

export async function createDailyChannel(userId: string): Promise<Channel> {
  const channelId = `${userId}${DAILY_CHANNEL_SUFFIX}`;
  const channel: Channel = {
    id: channelId,
    name: 'Daily',
    description: 'Your daily updates channel',
    color: 'AMBER',
    isDaily: true,
    ownerId: userId,
    subscribers: [],
    inviteCode: null,
    createdAt: Date.now(),
    markedForDeletionAt: null,
  };
  await setDoc(doc(db, 'channels', channelId), channel);
  return channel;
}

export async function createCustomChannel(channelData: NewChannel): Promise<Channel> {
  const channelId = generateId('nano');
  const inviteCode = generateId('nano').substring(0, 8).toUpperCase();
  const channel: Channel = {
    ...channelData,
    id: channelId,
    isDaily: false,
    inviteCode,
    createdAt: Date.now(),
    markedForDeletionAt: null,
  };

  await runTransaction(db, async (transaction) => {
    const secretRef = doc(db, 'usersSecret', channelData.ownerId);
    const secretSnap = await transaction.get(secretRef);
    if (!secretSnap.exists) throw new Error('User not found');

    const secretData = secretSnap.data() as UserSecret;
    if (secretData.customChannelCount >= 3) {
      throw new Error('Maximum custom channels reached');
    }

    transaction.set(doc(db, 'channels', channelId), channel);
    transaction.update(secretRef, {
      customChannelCount: secretData.customChannelCount + 1,
    });
  });

  return channel;
}

export async function updateCustomChannel(channel: Channel): Promise<void> {
  const { id, ownerId, isDaily, createdAt, ...updateData } = channel;
  void ownerId;
  void isDaily;
  void createdAt;
  await updateDoc(doc(db, 'channels', id), updateData);
}

export async function deleteCustomChannel(channelId: string, ownerId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const secretRef = doc(db, 'usersSecret', ownerId);
    const secretSnap = await transaction.get(secretRef);
    if (!secretSnap.exists) throw new Error('User not found');

    const secretData = secretSnap.data() as UserSecret;
    transaction.update(doc(db, 'channels', channelId), {
      markedForDeletionAt: Date.now(),
    });
    transaction.update(secretRef, {
      customChannelCount: Math.max(0, secretData.customChannelCount - 1),
    });
  });
}

export async function refreshChannelInviteCode(channelId: string): Promise<string> {
  const newCode = generateId('nano').substring(0, 8).toUpperCase();
  await runTransaction(db, async (transaction) => {
    const channelRef = doc(db, 'channels', channelId);
    const channelSnap = await transaction.get(channelRef);
    if (!channelSnap.exists) throw new Error('Channel not found');
    transaction.update(channelRef, { inviteCode: newCode });
  });
  return newCode;
}

export async function unsubscribeFromChannel(channelId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'channels', channelId), {
    subscribers: arrayRemove(userId),
  });
}

export async function removeSubscriberFromChannel(
  channelId: string,
  subscriberId: string
): Promise<void> {
  await updateDoc(doc(db, 'channels', channelId), {
    subscribers: arrayRemove(subscriberId),
  });
}

// ---- Join Request Operations ----

export async function createJoinRequest(
  channelId: string,
  inviteCode: string,
  requesterId: string,
  channelOwnerId: string,
  message: string
): Promise<ChannelJoinRequest> {
  const id = generateId('nano');
  const request: ChannelJoinRequest = {
    id,
    channelId,
    channelOwnerId,
    requesterId,
    message,
    status: 'pending',
    createdAt: Date.now(),
    respondedAt: null,
  };
  await setDoc(doc(db, 'channelJoinRequests', id), request);
  return request;
}

export async function respondToJoinRequest(
  requestId: string,
  accept: boolean
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(db, 'channelJoinRequests', requestId);
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) throw new Error('Request not found');

    const request = requestSnap.data() as ChannelJoinRequest;
    const status = accept ? 'accepted' : 'declined';

    transaction.update(requestRef, {
      status,
      respondedAt: Date.now(),
    });

    if (accept) {
      transaction.update(doc(db, 'channels', request.channelId), {
        subscribers: arrayUnion(request.requesterId),
      });
    }
  });
}

// ---- Post Operations ----

export async function createPost(post: Post): Promise<void> {
  await setDoc(doc(db, 'posts', post.id), post);
}

export async function updatePost(postId: string, data: Partial<Post>): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), data);
}

export async function deletePost(postId: string): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    markedForDeletionAt: Date.now(),
  });
}

export async function joinConversation(postId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    conversationEnrollees: arrayUnion(userId),
  });
}

export async function updatePostReactions(postId: string, reactions: unknown[]): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), { reactions });
}

export async function addReactionToPost(postId: string, reaction: { emoji: string; userId: string }): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    reactions: arrayUnion(reaction),
  });
}

export async function removeReactionFromPost(postId: string, reaction: { emoji: string; userId: string }): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    reactions: arrayRemove(reaction),
  });
}

export async function addComment(postId: string, comment: Comment): Promise<void> {
  await setDoc(
    doc(db, 'posts', postId, 'comments', comment.id),
    comment,
  );
}

export function subscribeToComments(
  postId: string,
  callback: (comments: Comment[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'posts', postId, 'comments'),
      orderBy('timestamp', 'asc'),
    ),
    (snap) => {
      const comments = snap?.docs?.map((d) => d.data() as Comment) ?? [];
      callback(comments);
    },
    (_error) => {
      callback([]);
    },
  );
}

// ---- Subscriptions ----

export function subscribeToCurrentUser(
  uid: string,
  callback: (user: User | null) => void
): () => void {
  let publicData: UserPublic | null = null;
  let privateData: UserPrivate | null = null;
  let secretData: UserSecret | null = null;

  // Track which sub-documents have had their first snapshot; only emit once all
  // three have fired to avoid dispatching an incomplete User during initial load.
  const ready = { public: false, private: false, secret: false };

  function emit() {
    if (!ready.public || !ready.private || !ready.secret) return;
    if (!publicData) {
      callback(null);
      return;
    }
    callback(mergeUserDocs(publicData, privateData, secretData));
  }

  const unsubPublic = onSnapshot(doc(db, 'usersPublic', uid), (snap) => {
    publicData = snap.exists ? (snap.data() as UserPublic) : null;
    ready.public = true;
    emit();
  });

  const unsubPrivate = onSnapshot(doc(db, 'usersPrivate', uid), (snap) => {
    privateData = snap.exists ? (snap.data() as UserPrivate) : null;
    ready.private = true;
    emit();
  });

  const unsubSecret = onSnapshot(doc(db, 'usersSecret', uid), (snap) => {
    secretData = snap.exists ? (snap.data() as UserSecret) : null;
    ready.secret = true;
    emit();
  });

  return () => {
    unsubPublic();
    unsubPrivate();
    unsubSecret();
  };
}

export function subscribeToChannels(
  uid: string,
  callback: (channels: Channel[]) => void,
): () => void {
  // Use two targeted queries instead of a global collection scan to avoid
  // client-side filtering bugs (e.g. channels with missing `subscribers` fields
  // causing Array.prototype.includes() to throw and silently drop all results).
  const ownedMap = new Map<string, Channel>();
  const subscribedMap = new Map<string, Channel>();

  function emit() {
    // Merge maps; owned takes precedence over subscribed for the same channel id.
    const merged = new Map<string, Channel>(ownedMap);
    for (const [id, ch] of subscribedMap) {
      if (!merged.has(id)) merged.set(id, ch);
    }
    callback(
      Array.from(merged.values()).filter((ch) => ch.markedForDeletionAt == null),
    );
  }

  const unsubOwned = onSnapshot(
    query(collection(db, 'channels'), where('ownerId', '==', uid)),
    (snap) => {
      ownedMap.clear();
      for (const d of snap.docs) ownedMap.set(d.id, d.data() as Channel);
      emit();
    },
    (_err) => { emit(); },
  );

  const unsubSubscribed = onSnapshot(
    query(collection(db, 'channels'), where('subscribers', 'array-contains', uid)),
    (snap) => {
      subscribedMap.clear();
      for (const d of snap.docs) subscribedMap.set(d.id, d.data() as Channel);
      emit();
    },
    (_err) => { emit(); },
  );

  return () => {
    unsubOwned();
    unsubSubscribed();
  };
}

export function subscribeToPosts(
  uid: string,
  channelIds: string[],
  callback: (posts: Post[]) => void
): () => void {
  if (channelIds.length === 0) {
    callback([]);
    return () => {};
  }

  // Firestore `in` queries limited to 30 values — batch if needed
  const batches: string[][] = [];
  for (let i = 0; i < channelIds.length; i += 30) {
    batches.push(channelIds.slice(i, i + 30));
  }

  const allPosts: Map<string, Post> = new Map();
  const unsubscribes: Array<() => void> = [];

  for (const batch of batches) {
    const unsub = onSnapshot(
      query(
        collection(db, 'posts'),
        where('channelId', 'in', batch),
        where('markedForDeletionAt', '==', null),
      ),
      (snap) => {
        if (!snap) return;
        for (const d of snap.docs) {
          allPosts.set(d.id, d.data() as Post);
        }
        callback(Array.from(allPosts.values()));
      },
      (error) => {
        // Query failed (missing index or rules denial) — return what we have so far
        callback(Array.from(allPosts.values()));
      },
    );
    unsubscribes.push(unsub);
  }

  return () => unsubscribes.forEach((u) => u());
}

export function subscribeToIncomingJoinRequests(
  uid: string,
  callback: (requests: ChannelJoinRequest[]) => void
): () => void {
  return onSnapshot(
    query(collection(db, 'channelJoinRequests'), where('channelOwnerId', '==', uid)),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as ChannelJoinRequest));
    },
  );
}

export function subscribeToOutgoingJoinRequests(
  uid: string,
  callback: (requests: ChannelJoinRequest[]) => void
): () => void {
  return onSnapshot(
    query(collection(db, 'channelJoinRequests'), where('requesterId', '==', uid)),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as ChannelJoinRequest));
    },
  );
}

export function subscribeToChannelUsers(
  userIds: string[],
  callback: (users: User[]) => void
): () => void {
  if (userIds.length === 0) {
    callback([]);
    return () => {};
  }

  const batches: string[][] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    batches.push(userIds.slice(i, i + 30));
  }

  const publicDataMap: Map<string, UserPublic> = new Map();
  const privateDataMap: Map<string, UserPrivate> = new Map();
  const unsubscribes: Array<() => void> = [];

  function emitMerged() {
    const merged: User[] = [];
    for (const [id, pub] of publicDataMap) {
      const priv = privateDataMap.get(id) ?? null;
      merged.push(mergeUserDocs(pub, priv, null));
    }
    callback(merged);
  }

  for (const batch of batches) {
    const unsubPub = onSnapshot(
      query(collection(db, 'usersPublic'), where('__name__', 'in', batch)),
      (snap) => {
        for (const d of snap.docs) {
          publicDataMap.set(d.id, d.data() as UserPublic);
        }
        emitMerged();
      },
    );
    const unsubPriv = onSnapshot(
      query(collection(db, 'usersPrivate'), where('__name__', 'in', batch)),
      (snap) => {
        for (const d of snap.docs) {
          privateDataMap.set(d.id, d.data() as UserPrivate);
        }
        emitMerged();
      },
    );
    unsubscribes.push(unsubPub, unsubPriv);
  }

  return () => unsubscribes.forEach((u) => u());
}

// ---- Message Operations (subcollection under posts) ----

export async function addMessage(postId: string, message: Message): Promise<void> {
  await setDoc(
    doc(db, 'posts', postId, 'messages', message.id),
    message,
  );
}

export function subscribeToMessages(
  postId: string,
  callback: (messages: Message[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'posts', postId, 'messages'),
      orderBy('timestamp', 'asc'),
    ),
    (snap) => {
      const messages = snap?.docs?.map((d) => d.data() as Message) ?? [];
      callback(messages);
    },
    (_error) => {
      // Firestore subscription error — return empty to avoid crash
      callback([]);
    },
  );
}

// ── App Notification Operations ────────────────────────────────────────────

/**
 * Writes a notification document to the top-level `notifications` collection.
 * A Cloud Function listens for new documents, sends the FCM push to the target
 * user's registered devices, and then deletes the document.
 */
export async function createAppNotification(notification: AppNotification): Promise<void> {
  await setDoc(doc(db, 'notifications', notification.id), notification);
}

// ── Connection Operations ────────────────────────────────────────────────────

/**
 * Creates a connection request from `fromId` to `toId`.
 * The host (`toId`) whose link was shared will receive an FCM notification.
 */
export async function createConnectionRequest(
  fromId: string,
  toId: string,
  note?: string,
): Promise<ConnectionRequest> {
  const id = generateId('nano');
  const request: ConnectionRequest = {
    id,
    fromId,
    toId,
    status: 'pending',
    createdAt: Date.now(),
    respondedAt: null,
    note: note?.trim() || null,
  };
  await setDoc(doc(db, 'connectionRequests', id), request);
  return request;
}

export async function getConnectionRequest(requestId: string): Promise<ConnectionRequest | null> {
  const snap = await getDoc(doc(db, 'connectionRequests', requestId));
  return snap.exists ? (snap.data() as ConnectionRequest) : null;
}

/**
 * Updates a connection request status to 'accepted' or 'declined'.
 * Mutual connection documents (`connections/{id}/people/{id}`) are written
 * by a Cloud Function that triggers on this status change.
 */
export async function respondToConnectionRequest(
  requestId: string,
  accept: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'connectionRequests', requestId), {
    status: accept ? 'accepted' : 'declined',
    respondedAt: Date.now(),
  });
}

/**
 * Returns existing pending/accepted connection request between two users,
 * or null if none exists.
 */
export async function getExistingConnectionRequest(
  fromId: string,
  toId: string,
): Promise<ConnectionRequest | null> {
  const snap = await getDocs(
    query(
      collection(db, 'connectionRequests'),
      where('fromId', '==', fromId),
      where('toId', '==', toId),
      where('status', 'in', ['pending', 'accepted']),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as ConnectionRequest;
}

/** Subscribes to incoming connection requests (toId == uid). */
export function subscribeToIncomingConnectionRequests(
  uid: string,
  callback: (requests: ConnectionRequest[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'connectionRequests'), where('toId', '==', uid)),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as ConnectionRequest));
    },
  );
}

/** Subscribes to outgoing connection requests (fromId == uid). */
export function subscribeToOutgoingConnectionRequests(
  uid: string,
  callback: (requests: ConnectionRequest[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'connectionRequests'), where('fromId', '==', uid)),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as ConnectionRequest));
    },
  );
}

/**
 * Subscribes to the current user's accepted connections.
 * Stored at `connections/{userId}/people/{connectedUserId}`.
 * Written by the Cloud Function that handles connection request acceptance.
 */
export function subscribeToConnections(
  uid: string,
  callback: (connections: Connection[]) => void,
): () => void {
  return onSnapshot(
    collection(db, 'connections', uid, 'people'),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as Connection));
    },
  );
}

/**
 * Subscribes to channel documents for a list of user IDs' daily channels.
 * Used to populate the Redux channels state with connected users' daily channels.
 */
export function subscribeToConnectionChannels(
  connectedUserIds: string[],
  callback: (channels: Channel[]) => void,
): () => void {
  if (connectedUserIds.length === 0) {
    callback([]);
    return () => {};
  }

  const dailyChannelIds = connectedUserIds.map((id) => `${id}${DAILY_CHANNEL_SUFFIX}`);

  const batches: string[][] = [];
  for (let i = 0; i < dailyChannelIds.length; i += 30) {
    batches.push(dailyChannelIds.slice(i, i + 30));
  }

  const allChannels: Map<string, Channel> = new Map();
  const unsubscribes: Array<() => void> = [];

  for (const batch of batches) {
    const unsub = onSnapshot(
      query(collection(db, 'channels'), where('__name__', 'in', batch)),
      (snap) => {
        for (const d of snap.docs) {
          allChannels.set(d.id, d.data() as Channel);
        }
        callback(Array.from(allChannels.values()));
      },
    );
    unsubscribes.push(unsub);
  }

  return () => unsubscribes.forEach((u) => u());
}

// ── Feedback & Support Operations ───────────────────────────────────────────

/**
 * Writes a feedback submission to the top-level `feedback` collection.
 * Only the submitting user can create the document; no client reads/updates.
 */
export async function submitFeedback(submission: FeedbackSubmission): Promise<void> {
  await setDoc(doc(db, 'feedback', submission.id), submission);
}

// ── Private Note Operations ─────────────────────────────────────────────────

/**
 * Writes a private note to the `posts/{postId}/privateNotes/{noteId}` subcollection.
 * Notes are automatically deleted when the parent post is removed.
 * Only the note author can create; only the host (post author) can read.
 */
export async function createPrivateNote(note: PrivateNote): Promise<void> {
  await setDoc(doc(db, 'posts', note.postId, 'privateNotes', note.id), note);
}

/**
 * Subscribes to all private notes under `posts/{postId}/privateNotes`, ordered
 * by timestamp ascending.
 * Only the host (post author) should call this — the Firestore rules enforce it.
 */
export function subscribeToPrivateNotesForPost(
  postId: string,
  callback: (notes: PrivateNote[]) => void,
  onError?: () => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'posts', postId, 'privateNotes'),
      orderBy('timestamp', 'asc'),
    ),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as PrivateNote));
    },
    (_error) => {
      onError?.();
    },
  );
}


/**
 * Subscribes to the private notes written by `authorId` under
 * `posts/{postId}/privateNotes`, filtered to only their own notes.
 * Results are sorted by timestamp ascending (client-side, no composite index needed).
 *
 * Should only be called by the note's author (visitor) — the Firestore rules enforce it.
 */
export function subscribeToMyPrivateNotesForPost(
  postId: string,
  authorId: string,
  callback: (notes: PrivateNote[]) => void,
  onError?: () => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'posts', postId, 'privateNotes'),
      where('authorId', '==', authorId),
    ),
    (snap) => {
      const notes = snap.docs.map((d) => d.data() as PrivateNote);
      notes.sort((a, b) => a.timestamp - b.timestamp);
      callback(notes);
    },
    (_error) => {
      onError?.();
    },
  );
}


/**
 * Creates a task document in the user's tasks subcollection.
 * Stored at `tasks/{userId}/items/{taskId}`.
 */
export async function createTask(task: AppTask): Promise<void> {
  await setDoc(
    doc(db, 'tasks', task.userId, 'items', task.id),
    task,
  );
}

/**
 * Marks a task as completed by setting its `completedAt` timestamp.
 */
export async function markTaskComplete(userId: string, taskId: string): Promise<void> {
  await updateDoc(
    doc(db, 'tasks', userId, 'items', taskId),
    { completedAt: Date.now() },
  );
}

/**
 * Subscribes to all pending (not completed) tasks for the given user.
 */
export function subscribeToTasks(
  userId: string,
  callback: (tasks: AppTask[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, 'tasks', userId, 'items'),
      where('completedAt', '==', null),
    ),
    (snap) => {
      callback(snap.docs.map((d) => d.data() as AppTask));
    },
    (_error) => {
      callback([]);
    },
  );
}
