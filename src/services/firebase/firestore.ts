import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import type { User, Channel, Post, NewUser, NewChannel, ChannelJoinRequest, UpdateUserProfileData } from '@/models/types';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';
import { generateId } from '@/utils/generateId';

// ---- User Operations ----

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as User) : null;
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

// ---- Channel Operations ----

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
    if (!userSnap.exists()) throw new Error('User not found');

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
    if (!userSnap.exists()) throw new Error('User not found');

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
    if (!channelSnap.exists()) throw new Error('Channel not found');
    transaction.update(channelRef, { inviteCode: newCode });
  });
  return newCode;
}

export async function unsubscribeFromChannel(channelId: string, userId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const channelRef = doc(db, 'channels', channelId);
    transaction.update(channelRef, {
      subscribers: arrayRemove(userId),
    });
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
    if (!requestSnap.exists()) throw new Error('Request not found');

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

export async function updatePostComments(postId: string, comments: unknown[]): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), { comments });
}

// ---- Subscriptions ----

export function subscribeToCurrentUser(
  uid: string,
  callback: (user: User | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? (snap.data() as User) : null);
  });
}

export function subscribeToChannels(
  uid: string,
  callback: (channels: Channel[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'channels'),
    where('markedForDeletionAt', '==', null)
  );
  return onSnapshot(q, (snap) => {
    const channels = snap.docs
      .map((d) => d.data() as Channel)
      .filter((ch) => ch.ownerId === uid || ch.subscribers.includes(uid));
    callback(channels);
  });
}

export function subscribeToPosts(
  uid: string,
  channelIds: string[],
  callback: (posts: Post[]) => void
): Unsubscribe {
  if (channelIds.length === 0) {
    callback([]);
    return () => {};
  }

  // Firestore `in` queries limited to 30 values — batch if needed
  const batches = [];
  for (let i = 0; i < channelIds.length; i += 30) {
    batches.push(channelIds.slice(i, i + 30));
  }

  const allPosts: Map<string, Post> = new Map();
  const unsubscribes: Unsubscribe[] = [];

  for (const batch of batches) {
    const q = query(
      collection(db, 'posts'),
      where('channelId', 'in', batch),
      where('markedForDeletionAt', '==', null)
    );
    const unsub = onSnapshot(q, (snap) => {
      for (const d of snap.docs) {
        allPosts.set(d.id, d.data() as Post);
      }
      callback(Array.from(allPosts.values()));
    });
    unsubscribes.push(unsub);
  }

  return () => unsubscribes.forEach((u) => u());
}

export function subscribeToIncomingJoinRequests(
  uid: string,
  callback: (requests: ChannelJoinRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'channelJoinRequests'),
    where('channelOwnerId', '==', uid)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as ChannelJoinRequest));
  });
}

export function subscribeToOutgoingJoinRequests(
  uid: string,
  callback: (requests: ChannelJoinRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'channelJoinRequests'),
    where('requesterId', '==', uid)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as ChannelJoinRequest));
  });
}

export function subscribeToChannelUsers(
  userIds: string[],
  callback: (users: User[]) => void
): Unsubscribe {
  if (userIds.length === 0) {
    callback([]);
    return () => {};
  }

  const batches = [];
  for (let i = 0; i < userIds.length; i += 30) {
    batches.push(userIds.slice(i, i + 30));
  }

  const allUsers: Map<string, User> = new Map();
  const unsubscribes: Unsubscribe[] = [];

  for (const batch of batches) {
    const q = query(collection(db, 'users'), where('__name__', 'in', batch));
    const unsub = onSnapshot(q, (snap) => {
      for (const d of snap.docs) {
        allUsers.set(d.id, d.data() as User);
      }
      callback(Array.from(allUsers.values()));
    });
    unsubscribes.push(unsub);
  }

  return () => unsubscribes.forEach((u) => u());
}
