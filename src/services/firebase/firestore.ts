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
import type { User, Channel, Post, NewUser, NewChannel, ChannelJoinRequest, UpdateUserProfileData, UserStatus, PostTier, FcmTokenEntry, NotificationSettings, NotificationSettingsUpdate, Message } from '@/models/types';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';
import { generateId } from '@/utils/generateId';

const db = getFirestore();

// ---- User Operations ----

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists ? (snap.data() as User) : null;
}

export async function createUserProfile(userData: NewUser): Promise<void> {
  await setDoc(doc(db, 'users', userData.id), {
    ...userData,
    joinedAt: Date.now(),
    accountProgress: {
      signUpComplete: true,
      emailVerified: false,
      dailyChannelCreated: false,
    },
    customChannelCount: 0,
    status: null,
  });
}

export async function updateUserProfile(uid: string, data: UpdateUserProfileData): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { ...data });
}

export async function updateAccountProgress(
  uid: string,
  field: string,
  value: boolean
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    [`accountProgress.${field}`]: value,
  });
}

export async function updateUserStatus(uid: string, status: UserStatus | null): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { status });
}

export async function updateChannelTierPrefs(uid: string, prefs: Record<string, PostTier[]>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { channelTierPrefs: prefs });
}

// ---- Notification Settings Operations ----

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  fcmTokens: [],
  dailyPrompt: {
    enabled: true,
    hour: 12,
    minute: 0,
  },
  windDownPrompt: {
    enabled: true,
    hour: 17,
    minute: 30,
  },
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
    const userRef = doc(db, 'users', channelData.ownerId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error('User not found');

    const userData = userSnap.data() as User;
    if (userData.customChannelCount >= 3) {
      throw new Error('Maximum custom channels reached');
    }

    transaction.set(doc(db, 'channels', channelId), channel);
    transaction.update(userRef, {
      customChannelCount: userData.customChannelCount + 1,
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
    const userRef = doc(db, 'users', ownerId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error('User not found');

    const userData = userSnap.data() as User;
    transaction.update(doc(db, 'channels', channelId), {
      markedForDeletionAt: Date.now(),
    });
    transaction.update(userRef, {
      customChannelCount: Math.max(0, userData.customChannelCount - 1),
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

export async function updatePostComments(postId: string, comments: unknown[]): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), { comments });
}

export async function addCommentToPost(postId: string, comment: { id: string; authorId: string; text: string; timestamp: number }): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    comments: arrayUnion(comment),
  });
}

// ---- Subscriptions ----

export function subscribeToCurrentUser(
  uid: string,
  callback: (user: User | null) => void
): () => void {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists ? (snap.data() as User) : null);
  });
}

export function subscribeToChannels(
  uid: string,
  callback: (channels: Channel[]) => void
): () => void {
  return onSnapshot(
    query(collection(db, 'channels'), where('markedForDeletionAt', '==', null)),
    (snap) => {
      const channels = snap.docs
        .map((d) => d.data() as Channel)
        .filter((ch) => ch.ownerId === uid || ch.subscribers.includes(uid));
      callback(channels);
    },
  );
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
        for (const d of snap.docs) {
          allPosts.set(d.id, d.data() as Post);
        }
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

  const allUsers: Map<string, User> = new Map();
  const unsubscribes: Array<() => void> = [];

  for (const batch of batches) {
    const unsub = onSnapshot(
      query(collection(db, 'users'), where('__name__', 'in', batch)),
      (snap) => {
        for (const d of snap.docs) {
          allUsers.set(d.id, d.data() as User);
        }
        callback(Array.from(allUsers.values()));
      },
    );
    unsubscribes.push(unsub);
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
