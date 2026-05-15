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
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { User, UserPublic, UserPrivate, UserSecret, Channel, Post, NewUser, NewChannel, ChannelJoinRequest, CircleInviteRequest, UpdateUserProfileData, UserStatus, FcmTokenEntry, NotificationSettings, NotificationSettingsUpdate, Message, AppNotification, Connection, ConnectionRequest, FeedbackSubmission, AppTask, Comment, PrivateNote, Reaction } from '@/models/types';
import {
  DAILY_CHANNEL_SUFFIX,
  DEFAULT_WIND_DOWN_PROMPT,
  DEFAULT_POST_ACTIVITY_NOTIFICATION_SETTINGS,
  createDefaultCirclePostNotificationSettings,
} from '@/models/constants';
import { generateId } from '@/utils/generateId';

// const db = getFirestore();
const getDb = () => getFirestore();

function getSnapshotDocs(
  snap: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData> | null | undefined,
): FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>[] {
  return snap?.docs ?? [];
}

// ---- User Operations ----

/**
 * Safe defaults for UserSecret fields when the secret document is unavailable
 * (e.g. when loading another user's public/private data only).
 *
 * accountProgress fields default to false so that a missing secret document
 * (e.g. mid-onboarding, before createUserProfile writes the secret doc) is
 * treated as "not yet onboarded" and correctly redirects to complete-profile.
 * For other users' profiles these fields are never surfaced in the UI.
 */
const DEFAULT_USER_SECRET: UserSecret = {
  accountProgress: {
    signUpComplete: false,
    emailVerified: false,
    dailyChannelCreated: false,
    onboardingComplete: false,
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
    getDoc(doc(getDb(), 'usersPublic', uid)),
    getDoc(doc(getDb(), 'usersPrivate', uid)),
    getDoc(doc(getDb(), 'usersSecret', uid)),
  ]);
  if (!pubSnap.exists) return null;
  return mergeUserDocs(
    pubSnap.data() as UserPublic,
    privSnap.exists ? (privSnap.data() as UserPrivate) : null,
    secSnap.exists ? (secSnap.data() as UserSecret) : null,
  );
}

/**
 * Fetches a user's public-facing profile (name, avatar, fun fact) without
 * requiring access to the secret sub-document.
 *
 * This is safe to call for any user — including from the public connect-request
 * screen before the visitor signs in — because `usersPublic` is readable by
 * anyone and `usersPrivate` (fun fact, status) is readable by any signed-in
 * user. If either read fails due to missing auth, the function degrades
 * gracefully: it returns the public fields only (no fun fact or status).
 */
export async function getPublicUserProfile(uid: string): Promise<User | null> {
  const pubSnap = await getDoc(doc(getDb(), 'usersPublic', uid)).catch(() => null);
  if (!pubSnap?.exists) return null;
  const pub = pubSnap.data() as UserPublic;

  // usersPrivate is readable by any signed-in user. For unauthenticated visitors
  // this will fail — catch the error and continue without private fields.
  const privSnap = await getDoc(doc(getDb(), 'usersPrivate', uid)).catch(() => null);
  const priv = privSnap?.exists ? (privSnap.data() as UserPrivate) : null;

  return mergeUserDocs(pub, priv, null);
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
      onboardingComplete: false,
    },
    customChannelCount: 0,
  };
  await Promise.all([
    setDoc(doc(getDb(), 'usersPublic', userData.id), publicData),
    setDoc(doc(getDb(), 'usersPrivate', userData.id), privateData),
    setDoc(doc(getDb(), 'usersSecret', userData.id), secretData),
  ]);
}

export async function savePublicProfile(uid: string, data: Pick<UserPublic, 'id' | 'firstName' | 'lastName' | 'avatar' | 'avatarUrl'>): Promise<void> {
  await setDoc(doc(getDb(), 'usersPublic', uid), { ...data, joinedAt: Date.now() }, { merge: true });
}

export async function updateUserProfile(uid: string, data: UpdateUserProfileData): Promise<void> {
  const { funFact, ...publicFields } = data;
  const updates: Promise<void>[] = [
    updateDoc(doc(getDb(), 'usersPublic', uid), publicFields),
  ];
  // Only write to usersPrivate when funFact is explicitly provided.
  if (funFact !== undefined) {
    updates.push(updateDoc(doc(getDb(), 'usersPrivate', uid), { funFact }));
  }
  await Promise.all(updates);
}

export async function updateAccountProgress(
  uid: string,
  field: string,
  value: boolean
): Promise<void> {
  await updateDoc(doc(getDb(), 'usersSecret', uid), {
    [`accountProgress.${field}`]: value,
  });
}

export async function updateUserStatus(uid: string, status: UserStatus | null): Promise<void> {
  await updateDoc(doc(getDb(), 'usersPrivate', uid), { status });
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
  postActivity: { ...DEFAULT_POST_ACTIVITY_NOTIFICATION_SETTINGS },
  postByCircle: {},
  timeZone: 'UTC',
  autoDetectTimeZone: true,
};

function normalizeCirclePostNotificationSettings(
  raw: unknown,
): NotificationSettings['postByCircle'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const normalized: NotificationSettings['postByCircle'] = {};
  for (const [channelId, value] of entries) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }
    normalized[channelId] = {
      ...createDefaultCirclePostNotificationSettings(),
      ...(value as NotificationSettings['postByCircle'][string]),
    };
  }

  return normalized;
}

function normalizeNotificationSettings(raw: NotificationSettings): NotificationSettings {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...raw,
    dailyPrompt: {
      ...DEFAULT_NOTIFICATION_SETTINGS.dailyPrompt,
      ...(raw.dailyPrompt ?? {}),
    },
    windDownPrompt: {
      ...DEFAULT_WIND_DOWN_PROMPT,
      ...(raw.windDownPrompt ?? {}),
    },
    postActivity: {
      ...DEFAULT_POST_ACTIVITY_NOTIFICATION_SETTINGS,
      ...(raw.postActivity ?? {}),
    },
    postByCircle: normalizeCirclePostNotificationSettings(raw.postByCircle),
  };
}

export async function getNotificationSettings(uid: string): Promise<NotificationSettings | null> {
  const snap = await getDoc(doc(getDb(), 'userNotificationSettings', uid));
  if (!snap?.exists) {
    return null;
  }
  return normalizeNotificationSettings(snap.data() as NotificationSettings);
}

export async function initNotificationSettings(
  uid: string,
  deviceTimeZone: string,
): Promise<NotificationSettings> {
  const settings: NotificationSettings = normalizeNotificationSettings({
    ...DEFAULT_NOTIFICATION_SETTINGS,
    timeZone: deviceTimeZone,
  });
  await setDoc(doc(getDb(), 'userNotificationSettings', uid), settings);
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
  await updateDoc(doc(getDb(), 'userNotificationSettings', uid), flat);
}

/**
 * Inserts or replaces the FCM token entry for this device (keyed by deviceId).
 * This ensures each device has exactly one entry regardless of how many times
 * the user signs in, solving token accumulation on repeated logins.
 */
export async function upsertFcmToken(uid: string, entry: FcmTokenEntry): Promise<void> {
  const docRef = doc(getDb(), 'userNotificationSettings', uid);
  await runTransaction(getDb(), async (transaction) => {
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
  const docRef = doc(getDb(), 'userNotificationSettings', uid);
  await runTransaction(getDb(), async (transaction) => {
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
  return onSnapshot(doc(getDb(), 'userNotificationSettings', uid), (snap) => {
    if (!snap) return;
    callback(snap.exists ? normalizeNotificationSettings(snap.data() as NotificationSettings) : null);
  });
}

export interface LatestAppVersionConfig {
  iosVersion: string | null;
  androidVersion: string | null;
  androidStoreUrl: string | null;
}

export interface FeedbackFormConfig {
  active: boolean;
  url: string | null;
  topic: string | null;
}

export type BroadcastMessageType = 'info' | 'warning' | 'success' | 'urgent';

export interface BroadcastMessageConfig {
  active: boolean;
  id: string | null;
  type: BroadcastMessageType;
  title: string | null;
  body: string | null;
}

export interface MobileAppConfig extends LatestAppVersionConfig {
  feedbackForm: FeedbackFormConfig;
  broadcastMessage: BroadcastMessageConfig;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

/**
 * Subscribes to a Firestore doc that controls required app versions by platform.
 *
 * Expected doc path: `appConfig/mobile`
 * Supported shapes:
 * - { iosVersion: '1.2.3', androidVersion: '1.2.3', androidStoreUrl: 'https://...' }
 * - { minVersions: { ios: '1.2.3', android: '1.2.3' }, androidStoreUrl: 'https://...' }
 */
export function subscribeToLatestAppVersion(
  callback: (config: LatestAppVersionConfig) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), 'appConfig', 'mobile'),
    (snap) => {
      const fallback: LatestAppVersionConfig = {
        iosVersion: null,
        androidVersion: null,
        androidStoreUrl: null,
      };

      if (!snap?.exists) {
        callback(fallback);
        return;
      }

      const raw = snap.data() as Record<string, unknown>;
      const minVersionsRaw = raw.minVersions;
      const minVersions =
        minVersionsRaw && typeof minVersionsRaw === 'object'
          ? (minVersionsRaw as Record<string, unknown>)
          : null;

      callback({
        iosVersion: asNonEmptyString(raw.iosVersion) ?? asNonEmptyString(minVersions?.ios),
        androidVersion: asNonEmptyString(raw.androidVersion) ?? asNonEmptyString(minVersions?.android),
        androidStoreUrl: asNonEmptyString(raw.androidStoreUrl),
      });
    },
    () => {
      callback({
        iosVersion: null,
        androidVersion: null,
        androidStoreUrl: null,
      });
    },
  );
}

const DEFAULT_FEEDBACK_FORM: FeedbackFormConfig = { active: false, url: null, topic: null };
const DEFAULT_BROADCAST_MESSAGE: BroadcastMessageConfig = {
  active: false,
  id: null,
  type: 'info',
  title: null,
  body: null,
};

/**
 * Subscribes to the full mobile app config from three separate flat Firestore
 * documents (no nested maps — each field is a top-level scalar so they can be
 * edited individually in the Firestore console without recreating a map).
 *
 * Documents:
 *   appConfig/mobile           → iosVersion, androidVersion, androidStoreUrl
 *   appConfig/broadcastMessage → active, id, type, title, body
 *   appConfig/feedbackForm     → active, url
 *
 * All three listeners run in parallel. A merged MobileAppConfig is emitted
 * whenever any document changes. Missing documents (not yet created in Firestore)
 * are treated as their safe defaults and do not block the first emission.
 */
export function subscribeToMobileAppConfig(
  callback: (config: MobileAppConfig) => void,
): () => void {
  let versionData: LatestAppVersionConfig = { iosVersion: null, androidVersion: null, androidStoreUrl: null };
  let broadcastData: BroadcastMessageConfig = { ...DEFAULT_BROADCAST_MESSAGE };
  let feedbackData: FeedbackFormConfig = { ...DEFAULT_FEEDBACK_FORM };

  // Each listener emits independently as soon as its own snapshot arrives.
  // Missing documents fall back to their safe defaults so one absent document
  // never blocks the others from taking effect.
  function emit() {
    callback({
      ...versionData,
      broadcastMessage: broadcastData,
      feedbackForm: feedbackData,
    });
  }

  const unsubVersion = onSnapshot(
    doc(getDb(), 'appConfig', 'mobile'),
    (snap) => {
      if (!snap?.exists) {
        versionData = { iosVersion: null, androidVersion: null, androidStoreUrl: null };
      } else {
        const raw = snap.data() as Record<string, unknown>;
        const minVersionsRaw = raw.minVersions;
        const minVersions =
          minVersionsRaw && typeof minVersionsRaw === 'object'
            ? (minVersionsRaw as Record<string, unknown>)
            : null;
        versionData = {
          iosVersion: asNonEmptyString(raw.iosVersion) ?? asNonEmptyString(minVersions?.ios),
          androidVersion: asNonEmptyString(raw.androidVersion) ?? asNonEmptyString(minVersions?.android),
          androidStoreUrl: asNonEmptyString(raw.androidStoreUrl),
        };
      }
      emit();
    },
    () => {
      versionData = { iosVersion: null, androidVersion: null, androidStoreUrl: null };
      emit();
    },
  );

  const unsubBroadcast = onSnapshot(
    doc(getDb(), 'appConfig', 'broadcastMessage'),
    (snap) => {
      if (!snap?.exists) {
        broadcastData = { ...DEFAULT_BROADCAST_MESSAGE };
      } else {
        const raw = snap.data() as Record<string, unknown>;
        const msgType = asNonEmptyString(raw.type);
        const validMsgType: BroadcastMessageType =
          msgType === 'info' || msgType === 'warning' || msgType === 'success' || msgType === 'urgent'
            ? msgType
            : 'info';
        broadcastData = {
          active: raw.active === true,
          id: asNonEmptyString(raw.id),
          type: validMsgType,
          title: asNonEmptyString(raw.title),
          body: asNonEmptyString(raw.body),
        };
      }
      emit();
    },
    () => {
      broadcastData = { ...DEFAULT_BROADCAST_MESSAGE };
      emit();
    },
  );

  const unsubFeedback = onSnapshot(
    doc(getDb(), 'appConfig', 'feedbackForm'),
    (snap) => {
      if (!snap?.exists) {
        feedbackData = { ...DEFAULT_FEEDBACK_FORM };
      } else {
        const raw = snap.data() as Record<string, unknown>;
        feedbackData = {
          active: raw.active === true,
          url: asNonEmptyString(raw.url),
          topic: asNonEmptyString(raw.topic),
        };
      }
      emit();
    },
    () => {
      feedbackData = { ...DEFAULT_FEEDBACK_FORM };
      emit();
    },
  );

  return () => {
    unsubVersion();
    unsubBroadcast();
    unsubFeedback();
  };
}

// ---- Channel Operations ----

export async function getChannel(channelId: string): Promise<Channel | null> {
  const snap = await getDoc(doc(getDb(), 'channels', channelId));
  return snap.exists ? (snap.data() as Channel) : null;
}

export async function getChannelByInviteCode(inviteCode: string): Promise<Channel | null> {
  const snap = await getDocs(
    query(
      collection(getDb(), 'channels'),
      where('inviteCode', '==', inviteCode),
      where('markedForDeletionAt', '==', null),
      limit(1),
    ),
  );
  if (snap.empty) return null;
  return snap.docs[0].data() as Channel;
}

/**
 * Returns active custom circles owned by `ownerId`.
 *
 * Uses an owner-only query and filters client-side to avoid adding a new
 * composite index for `isDaily` + `markedForDeletionAt`.
 */
export async function getActiveCustomChannelsByOwner(ownerId: string): Promise<Channel[]> {
  const snap = await getDocs(
    query(collection(getDb(), 'channels'), where('ownerId', '==', ownerId)),
  );
  return snap.docs
    .map((d) => {
      return d.data() as Channel;
    })
    .filter((ch) => {
      return ch.isDaily !== true && ch.markedForDeletionAt == null;
    });
}

export async function createDailyChannel(userId: string): Promise<Channel> {
  const channelId = `${userId}${DAILY_CHANNEL_SUFFIX}`;
  const channel: Channel = {
    id: channelId,
    name: 'Daily',
    description: 'Your daily updates channel',
    color: 'AMBER',
    isDaily: true,
    isPrivate: false,
    ownerId: userId,
    subscribers: [],
    inviteCode: null,
    createdAt: Date.now(),
    markedForDeletionAt: null,
  };
  await setDoc(doc(getDb(), 'channels', channelId), channel);
  return channel;
}

export async function createCustomChannel(channelData: NewChannel): Promise<Channel> {
  const channelId = generateId('nano');
  const inviteCode = generateId('nano').substring(0, 8).toUpperCase();
  const channel: Channel = {
    ...channelData,
    id: channelId,
    isDaily: false,
    isPrivate: channelData.isPrivate ?? false,
    inviteCode,
    createdAt: Date.now(),
    markedForDeletionAt: null,
  };

  await runTransaction(getDb(), async (transaction) => {
    const secretRef = doc(getDb(), 'usersSecret', channelData.ownerId);
    const secretSnap = await transaction.get(secretRef);
    if (!secretSnap.exists) throw new Error('User not found');

    const secretData = secretSnap.data() as UserSecret;
    if (secretData.customChannelCount >= 3) {
      throw new Error('Maximum custom channels reached');
    }

    transaction.set(doc(getDb(), 'channels', channelId), channel);
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
  await updateDoc(doc(getDb(), 'channels', id), updateData);
}

export async function deleteCustomChannel(channelId: string, ownerId: string): Promise<void> {
  await runTransaction(getDb(), async (transaction) => {
    const secretRef = doc(getDb(), 'usersSecret', ownerId);
    const secretSnap = await transaction.get(secretRef);
    if (!secretSnap.exists) throw new Error('User not found');

    const secretData = secretSnap.data() as UserSecret;
    transaction.update(doc(getDb(), 'channels', channelId), {
      markedForDeletionAt: Date.now(),
    });
    transaction.update(secretRef, {
      customChannelCount: Math.max(0, secretData.customChannelCount - 1),
    });
  });
}

export async function refreshChannelInviteCode(channelId: string): Promise<string> {
  const newCode = generateId('nano').substring(0, 8).toUpperCase();
  await runTransaction(getDb(), async (transaction) => {
    const channelRef = doc(getDb(), 'channels', channelId);
    const channelSnap = await transaction.get(channelRef);
    if (!channelSnap.exists) throw new Error('Channel not found');
    transaction.update(channelRef, { inviteCode: newCode });
  });
  return newCode;
}

export async function unsubscribeFromChannel(channelId: string, userId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'channels', channelId), {
    subscribers: arrayRemove(userId),
  });
}

export async function removeSubscriberFromChannel(
  channelId: string,
  subscriberId: string
): Promise<void> {
  await updateDoc(doc(getDb(), 'channels', channelId), {
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
  if (requesterId === channelOwnerId) {
    throw new Error('You cannot request to join your own Circle.');
  }

  const id = generateId('nano');
  void inviteCode;
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
  await setDoc(doc(getDb(), 'channelJoinRequests', id), request);
  return request;
}

export async function createCircleInviteRequest(
  channelId: string,
  channelOwnerId: string,
  inviterId: string,
  inviteeId: string,
): Promise<CircleInviteRequest> {
  const id = generateId('nano');
  const request: CircleInviteRequest = {
    id,
    channelId,
    channelOwnerId,
    inviterId,
    inviteeId,
    status: 'pending',
    createdAt: Date.now(),
    respondedAt: null,
  };
  await setDoc(doc(getDb(), 'circleInviteRequests', id), request);
  return request;
}

export async function respondToCircleInviteRequest(
  requestId: string,
  accept: boolean,
): Promise<void> {
  await runTransaction(getDb(), async (transaction) => {
    const requestRef = doc(getDb(), 'circleInviteRequests', requestId);
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) throw new Error('Request not found');

    const request = requestSnap.data() as CircleInviteRequest;
    const status = accept ? 'accepted' : 'declined';

    transaction.update(requestRef, {
      status,
      respondedAt: Date.now(),
    });

    if (accept) {
      const channelRef = doc(getDb(), 'channels', request.channelId);
      const channelSnap = await transaction.get(channelRef);
      if (!channelSnap.exists) throw new Error('Circle not found');
      const channelData = channelSnap.data();
      if (!channelData) throw new Error('Circle data unavailable');
      const channel = channelData as Channel;
      const alreadySubscriber = channel.subscribers.includes(request.inviteeId);
      if (!alreadySubscriber) {
        transaction.update(channelRef, {
          subscribers: arrayUnion(request.inviteeId),
        });
      }
    }
  });
}

export async function getCircleInviteRequest(requestId: string): Promise<CircleInviteRequest | null> {
  const snap = await getDoc(doc(getDb(), 'circleInviteRequests', requestId));
  return snap.exists ? (snap.data() as CircleInviteRequest) : null;
}

export function subscribeToIncomingCircleInviteRequests(
  uid: string,
  callback: (requests: CircleInviteRequest[]) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), 'circleInviteRequests'), where('inviteeId', '==', uid)),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as CircleInviteRequest;
      }));
    },
  );
}

export function subscribeToOutgoingCircleInviteRequests(
  uid: string,
  callback: (requests: CircleInviteRequest[]) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), 'circleInviteRequests'), where('inviterId', '==', uid)),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as CircleInviteRequest;
      }));
    },
  );
}

export async function respondToJoinRequest(
  requestId: string,
  accept: boolean
): Promise<void> {
  await runTransaction(getDb(), async (transaction) => {
    const requestRef = doc(getDb(), 'channelJoinRequests', requestId);
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) throw new Error('Request not found');

    const request = requestSnap.data() as ChannelJoinRequest;
    const status = accept ? 'accepted' : 'declined';

    transaction.update(requestRef, {
      status,
      respondedAt: Date.now(),
    });

    if (accept) {
      transaction.update(doc(getDb(), 'channels', request.channelId), {
        subscribers: arrayUnion(request.requesterId),
      });
    }
  });
}

// ---- Post Operations ----

export async function createPost(post: Post): Promise<void> {
  await setDoc(doc(getDb(), 'posts', post.id), post);
}

export async function updatePost(postId: string, data: Partial<Post>): Promise<void> {
  await updateDoc(doc(getDb(), 'posts', postId), data);
}

export async function deletePost(postId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'posts', postId), {
    markedForDeletionAt: Date.now(),
  });
}

export async function joinConversation(postId: string, userId: string): Promise<void> {
  await updateDoc(doc(getDb(), 'posts', postId), {
    conversationEnrollees: arrayUnion(userId),
  });
}

export async function updatePostReactions(postId: string, reactions: unknown[]): Promise<void> {
  await updateDoc(doc(getDb(), 'posts', postId), { reactions });
}

export async function addReactionToPost(postId: string, reaction: Reaction): Promise<void> {
  await updateDoc(doc(getDb(), 'posts', postId), {
    reactions: arrayUnion(reaction),
  });
}

export async function removeReactionsFromPostByUser(postId: string, userId: string): Promise<void> {
  await runTransaction(getDb(), async (transaction) => {
    const postRef = doc(getDb(), 'posts', postId);
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists) return;

    const post = postSnap.data() as Post;
    const nextReactions = (post.reactions ?? []).filter((item) => {
      return item.userId !== userId;
    });

    transaction.update(postRef, {
      reactions: nextReactions,
    });
  });
}

export async function addComment(postId: string, comment: Comment): Promise<void> {
  await setDoc(
    doc(getDb(), 'posts', postId, 'comments', comment.id),
    comment,
  );
}

export function subscribeToComments(
  postId: string,
  callback: (comments: Comment[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), 'posts', postId, 'comments'),
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

  const unsubPublic = onSnapshot(doc(getDb(), 'usersPublic', uid), (snap) => {
    if (!snap) return;
    publicData = snap.exists ? (snap.data() as UserPublic) : null;
    ready.public = true;
    emit();
  });

  const unsubPrivate = onSnapshot(doc(getDb(), 'usersPrivate', uid), (snap) => {
    if (!snap) return;
    privateData = snap.exists ? (snap.data() as UserPrivate) : null;
    ready.private = true;
    emit();
  });

  const unsubSecret = onSnapshot(doc(getDb(), 'usersSecret', uid), (snap) => {
    if (!snap) return;
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
    query(collection(getDb(), 'channels'), where('ownerId', '==', uid)),
    (snap) => {
      ownedMap.clear();
      for (const d of getSnapshotDocs(snap)) ownedMap.set(d.id, d.data() as Channel);
      emit();
    },
    (_err) => { emit(); },
  );

  const unsubSubscribed = onSnapshot(
    query(collection(getDb(), 'channels'), where('subscribers', 'array-contains', uid)),
    (snap) => {
      subscribedMap.clear();
      for (const d of getSnapshotDocs(snap)) subscribedMap.set(d.id, d.data() as Channel);
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
  callback: (posts: Post[]) => void,
  onError?: (error: unknown, batch: string[]) => void,
): () => void {
  if (channelIds.length === 0) {
    callback([]);
    return () => {};
  }
  // Defensively dedupe in case callers pass overlapping channel IDs.
  const uniqueChannelIds = Array.from(new Set(channelIds));

  // Firestore `in` queries limited to 30 values — batch if needed
  const batches: string[][] = [];
  for (let i = 0; i < uniqueChannelIds.length; i += 30) {
    batches.push(uniqueChannelIds.slice(i, i + 30));
  }

  const allPosts: Map<string, Post> = new Map();
  const postsByBatchKey: Map<string, Set<string>> = new Map();
  const postBatchMembership: Map<string, Set<string>> = new Map();
  const unsubscribes: Array<() => void> = [];

  for (const batch of batches) {
    const batchKey = batch.join('|');
    const unsub = onSnapshot(
      query(
        collection(getDb(), 'posts'),
        where('channelId', 'in', batch),
        where('markedForDeletionAt', '==', null),
      ),
      (snap) => {
        const nextBatchPostIds: Set<string> = new Set();
        for (const d of getSnapshotDocs(snap)) {
          const post = d.data() as Post;
          const normalizedPost: Post = {
            ...post,
            reactions: (post.reactions ?? []).map((reaction) => {
              return {
                emoji: reaction.emoji,
                userId: reaction.userId,
                timestamp: typeof reaction.timestamp === 'number' ? reaction.timestamp : null,
              };
            }),
          };
          nextBatchPostIds.add(d.id);
          allPosts.set(d.id, normalizedPost);
        }

        const previousBatchPostIds = postsByBatchKey.get(batchKey) ?? new Set<string>();
        previousBatchPostIds.forEach((postId) => {
          if (!nextBatchPostIds.has(postId)) {
            const membership = postBatchMembership.get(postId) ?? new Set<string>();
            membership.delete(batchKey);
            if (membership.size === 0) {
              postBatchMembership.delete(postId);
              allPosts.delete(postId);
              return;
            }
            postBatchMembership.set(postId, membership);
          }
        });

        nextBatchPostIds.forEach((postId) => {
          const membership = postBatchMembership.get(postId) ?? new Set<string>();
          membership.add(batchKey);
          postBatchMembership.set(postId, membership);
        });

        postsByBatchKey.set(batchKey, nextBatchPostIds);
        callback(Array.from(allPosts.values()));
      },
      (error) => {
        // Query failed (missing index or rules denial) — return what we have so far
        if (onError) {
          onError(error, batch);
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
    query(collection(getDb(), 'channelJoinRequests'), where('channelOwnerId', '==', uid)),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as ChannelJoinRequest;
      }));
    },
  );
}

export function subscribeToOutgoingJoinRequests(
  uid: string,
  callback: (requests: ChannelJoinRequest[]) => void
): () => void {
  return onSnapshot(
    query(collection(getDb(), 'channelJoinRequests'), where('requesterId', '==', uid)),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as ChannelJoinRequest;
      }));
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

  // Track per-batch readiness so we only emit after both the public AND private
  // snapshots have fired at least once for every batch.  Emitting after the
  // public-only snapshot would produce users with status === null, causing the
  // status badge on avatars to briefly disappear before the private data arrives.
  const totalBatches = batches.length;
  const publicBatchFired = new Array<boolean>(totalBatches).fill(false);
  const privateBatchFired = new Array<boolean>(totalBatches).fill(false);
  let publicBatchesReady = 0;
  let privateBatchesReady = 0;
  let allInitiallyReady = false;

  function emitMerged() {
    const merged: User[] = [];
    for (const [id, pub] of publicDataMap) {
      const priv = privateDataMap.get(id) ?? null;
      merged.push(mergeUserDocs(pub, priv, null));
    }
    callback(merged);
  }

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const unsubPub = onSnapshot(
      query(collection(getDb(), 'usersPublic'), where('__name__', 'in', batch)),
      (snap) => {
        for (const d of getSnapshotDocs(snap)) {
          publicDataMap.set(d.id, d.data() as UserPublic);
        }
        if (!publicBatchFired[batchIdx]) {
          publicBatchFired[batchIdx] = true;
          publicBatchesReady++;
        }
        // After initial readiness, every public update is safe to emit.
        if (allInitiallyReady) {
          emitMerged();
        } else if (publicBatchesReady === totalBatches && privateBatchesReady === totalBatches) {
          allInitiallyReady = true;
          emitMerged();
        }
      },
    );
    const unsubPriv = onSnapshot(
      query(collection(getDb(), 'usersPrivate'), where('__name__', 'in', batch)),
      (snap) => {
        for (const d of getSnapshotDocs(snap)) {
          privateDataMap.set(d.id, d.data() as UserPrivate);
        }
        if (!privateBatchFired[batchIdx]) {
          privateBatchFired[batchIdx] = true;
          privateBatchesReady++;
        }
        // Always emit once both collections have fired for all batches so that
        // status updates (from usersPrivate) are reflected immediately.
        if (allInitiallyReady) {
          emitMerged();
        } else if (publicBatchesReady === totalBatches && privateBatchesReady === totalBatches) {
          allInitiallyReady = true;
          emitMerged();
        }
      },
    );
    unsubscribes.push(unsubPub, unsubPriv);
  }

  return () => unsubscribes.forEach((u) => u());
}

// ---- Message Operations (subcollection under posts) ----

export async function addMessage(postId: string, message: Message): Promise<void> {
  await setDoc(
    doc(getDb(), 'posts', postId, 'messages', message.id),
    message,
  );
}

export async function updateMessageText(
  postId: string,
  messageId: string,
  text: string,
): Promise<void> {
  const messageRef = doc(getDb(), 'posts', postId, 'messages', messageId);
  const snapshot = await getDoc(messageRef).catch((error) => {
    console.error('[ConversationEdit] failed to read message before update', {
      postId,
      messageId,
      errorMessage: error instanceof Error ? error.message : String(error),
      rawError: error,
    });
    return null;
  });

  console.log('[ConversationEdit] firestore update payload', {
    postId,
    messageId,
    textLength: text.length,
    existingExists: snapshot?.exists ?? false,
    existingKeys: snapshot?.data ? Object.keys(snapshot.data() as Record<string, unknown>) : [],
    existingAuthorId: snapshot?.data ? (snapshot.data() as { authorId?: string }).authorId ?? null : null,
    existingIsSystem: snapshot?.data ? (snapshot.data() as { isSystem?: boolean }).isSystem ?? null : null,
  });

  await updateDoc(messageRef, {
    text,
  });
}

export function subscribeToMessages(
  postId: string,
  callback: (messages: Message[]) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), 'posts', postId, 'messages'),
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
  await setDoc(doc(getDb(), 'notifications', notification.id), notification);
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
  await setDoc(doc(getDb(), 'connectionRequests', id), request);
  return request;
}

export async function getConnectionRequest(requestId: string): Promise<ConnectionRequest | null> {
  const snap = await getDoc(doc(getDb(), 'connectionRequests', requestId));
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
  await updateDoc(doc(getDb(), 'connectionRequests', requestId), {
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
      collection(getDb(), 'connectionRequests'),
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
    query(collection(getDb(), 'connectionRequests'), where('toId', '==', uid)),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as ConnectionRequest;
      }));
    },
  );
}

/** Subscribes to outgoing connection requests (fromId == uid). */
export function subscribeToOutgoingConnectionRequests(
  uid: string,
  callback: (requests: ConnectionRequest[]) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), 'connectionRequests'), where('fromId', '==', uid)),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as ConnectionRequest;
      }));
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
    collection(getDb(), 'connections', uid, 'people'),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as Connection;
      }));
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
  onError?: (error: unknown, batch: string[]) => void,
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
      query(collection(getDb(), 'channels'), where('__name__', 'in', batch)),
      (snap) => {
        for (const d of getSnapshotDocs(snap)) {
          allChannels.set(d.id, d.data() as Channel);
        }
        callback(Array.from(allChannels.values()));
      },
      (error) => {
        if (onError) {
          onError(error, batch);
        }
        callback(Array.from(allChannels.values()));
      },
    );
    unsubscribes.push(unsub);
  }

  return () => unsubscribes.forEach((u) => u());
}

// ── Disconnect Operations ────────────────────────────────────────────────────

/**
 * Writes a `disconnectRequests` document to trigger the `onDisconnectRequest`
 * Cloud Function.  The CF deletes both connection documents and removes the
 * target user from all circles owned by the requester.
 */
export async function createDisconnectRequest(
  requesterId: string,
  targetUserId: string,
): Promise<void> {
  const id = generateId('nano');
  await setDoc(doc(getDb(), 'disconnectRequests', id), {
    requesterId,
    targetUserId,
    createdAt: Date.now(),
  });
}

// ── Feedback & Support Operations ───────────────────────────────────────────

/**
 * Writes a feedback submission to the top-level `feedback` collection.
 * Only the submitting user can create the document; no client reads/updates.
 */
export async function submitFeedback(submission: FeedbackSubmission): Promise<void> {
  await setDoc(doc(getDb(), 'feedback', submission.id), submission);
}

// ── Private Note Operations ─────────────────────────────────────────────────

/**
 * Writes a private note to the `posts/{postId}/privateNotes/{noteId}` subcollection.
 * Notes are automatically deleted when the parent post is removed.
 * Only the note author can create; only the host (post author) can read.
 */
export async function createPrivateNote(note: PrivateNote): Promise<void> {
  await setDoc(doc(getDb(), 'posts', note.postId, 'privateNotes', note.id), note);
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
      collection(getDb(), 'posts', postId, 'privateNotes'),
      orderBy('timestamp', 'asc'),
    ),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as PrivateNote;
      }));
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
      collection(getDb(), 'posts', postId, 'privateNotes'),
      where('authorId', '==', authorId),
    ),
    (snap) => {
      const notes = getSnapshotDocs(snap).map((d) => {
        return d.data() as PrivateNote;
      });
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
    doc(getDb(), 'tasks', task.userId, 'items', task.id),
    task,
  );
}

/**
 * Marks a task as completed by setting its `completedAt` timestamp.
 */
export async function markTaskComplete(userId: string, taskId: string): Promise<void> {
  await updateDoc(
    doc(getDb(), 'tasks', userId, 'items', taskId),
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
      collection(getDb(), 'tasks', userId, 'items'),
      where('completedAt', '==', null),
    ),
    (snap) => {
      callback(getSnapshotDocs(snap).map((d) => {
        return d.data() as AppTask;
      }));
    },
    (_error) => {
      callback([]);
    },
  );
}
