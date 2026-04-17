import firestore from '@react-native-firebase/firestore';
import type { User, Channel, Post, NewUser, NewChannel, ChannelJoinRequest, UpdateUserProfileData } from '@/models/types';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';
import { generateId } from '@/utils/generateId';

const db = firestore();

// ---- User Operations ----

export async function getUserProfile(uid: string): Promise<User | null> {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? (snap.data() as User) : null;
}

export async function createUserProfile(userData: NewUser): Promise<void> {
  await db.collection('users').doc(userData.id).set({
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
  await db.collection('users').doc(uid).update({ ...data });
}

export async function updateAccountProgress(
  uid: string,
  field: string,
  value: boolean
): Promise<void> {
  await db.collection('users').doc(uid).update({
    [`accountProgress.${field}`]: value,
  });
}

// ---- Channel Operations ----

export async function getChannel(channelId: string): Promise<Channel | null> {
  const snap = await db.collection('channels').doc(channelId).get();
  return snap.exists ? (snap.data() as Channel) : null;
}

export async function getChannelByInviteCode(inviteCode: string): Promise<Channel | null> {
  const snap = await db
    .collection('channels')
    .where('inviteCode', '==', inviteCode)
    .where('markedForDeletionAt', '==', null)
    .limit(1)
    .get();
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
  await db.collection('channels').doc(channelId).set(channel);
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

  await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(channelData.ownerId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error('User not found');

    const userData = userSnap.data() as User;
    if (userData.customChannelCount >= 3) {
      throw new Error('Maximum custom channels reached');
    }

    transaction.set(db.collection('channels').doc(channelId), channel);
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
  await db.collection('channels').doc(id).update(updateData);
}

export async function deleteCustomChannel(channelId: string, ownerId: string): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(ownerId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error('User not found');

    const userData = userSnap.data() as User;
    transaction.update(db.collection('channels').doc(channelId), {
      markedForDeletionAt: Date.now(),
    });
    transaction.update(userRef, {
      customChannelCount: Math.max(0, userData.customChannelCount - 1),
    });
  });
}

export async function refreshChannelInviteCode(channelId: string): Promise<string> {
  const newCode = generateId('nano').substring(0, 8).toUpperCase();
  await db.runTransaction(async (transaction) => {
    const channelRef = db.collection('channels').doc(channelId);
    const channelSnap = await transaction.get(channelRef);
    if (!channelSnap.exists) throw new Error('Channel not found');
    transaction.update(channelRef, { inviteCode: newCode });
  });
  return newCode;
}

export async function unsubscribeFromChannel(channelId: string, userId: string): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const channelRef = db.collection('channels').doc(channelId);
    transaction.update(channelRef, {
      subscribers: firestore.FieldValue.arrayRemove(userId),
    });
  });
}

export async function removeSubscriberFromChannel(
  channelId: string,
  subscriberId: string
): Promise<void> {
  await db.collection('channels').doc(channelId).update({
    subscribers: firestore.FieldValue.arrayRemove(subscriberId),
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
  await db.collection('channelJoinRequests').doc(id).set(request);
  return request;
}

export async function respondToJoinRequest(
  requestId: string,
  accept: boolean
): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const requestRef = db.collection('channelJoinRequests').doc(requestId);
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) throw new Error('Request not found');

    const request = requestSnap.data() as ChannelJoinRequest;
    const status = accept ? 'accepted' : 'declined';

    transaction.update(requestRef, {
      status,
      respondedAt: Date.now(),
    });

    if (accept) {
      transaction.update(db.collection('channels').doc(request.channelId), {
        subscribers: firestore.FieldValue.arrayUnion(request.requesterId),
      });
    }
  });
}

// ---- Post Operations ----

export async function createPost(post: Post): Promise<void> {
  await db.collection('posts').doc(post.id).set(post);
}

export async function updatePost(postId: string, data: Partial<Post>): Promise<void> {
  await db.collection('posts').doc(postId).update(data);
}

export async function deletePost(postId: string): Promise<void> {
  await db.collection('posts').doc(postId).update({
    markedForDeletionAt: Date.now(),
  });
}

export async function joinConversation(postId: string, userId: string): Promise<void> {
  await db.collection('posts').doc(postId).update({
    conversationEnrollees: firestore.FieldValue.arrayUnion(userId),
  });
}

export async function updatePostReactions(postId: string, reactions: unknown[]): Promise<void> {
  await db.collection('posts').doc(postId).update({ reactions });
}

export async function addReactionToPost(postId: string, reaction: { emoji: string; userId: string }): Promise<void> {
  await db.collection('posts').doc(postId).update({
    reactions: firestore.FieldValue.arrayUnion(reaction),
  });
}

export async function removeReactionFromPost(postId: string, reaction: { emoji: string; userId: string }): Promise<void> {
  await db.collection('posts').doc(postId).update({
    reactions: firestore.FieldValue.arrayRemove(reaction),
  });
}

export async function updatePostComments(postId: string, comments: unknown[]): Promise<void> {
  await db.collection('posts').doc(postId).update({ comments });
}

export async function addCommentToPost(postId: string, comment: { id: string; authorId: string; text: string; timestamp: number }): Promise<void> {
  await db.collection('posts').doc(postId).update({
    comments: firestore.FieldValue.arrayUnion(comment),
  });
}

// ---- Subscriptions ----

export function subscribeToCurrentUser(
  uid: string,
  callback: (user: User | null) => void
): () => void {
  return db.collection('users').doc(uid).onSnapshot((snap) => {
    callback(snap.exists ? (snap.data() as User) : null);
  });
}

export function subscribeToChannels(
  uid: string,
  callback: (channels: Channel[]) => void
): () => void {
  return db
    .collection('channels')
    .where('markedForDeletionAt', '==', null)
    .onSnapshot((snap) => {
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
    const unsub = db
      .collection('posts')
      .where('channelId', 'in', batch)
      .where('markedForDeletionAt', '==', null)
      .onSnapshot((snap) => {
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
): () => void {
  return db
    .collection('channelJoinRequests')
    .where('channelOwnerId', '==', uid)
    .onSnapshot((snap) => {
      callback(snap.docs.map((d) => d.data() as ChannelJoinRequest));
    });
}

export function subscribeToOutgoingJoinRequests(
  uid: string,
  callback: (requests: ChannelJoinRequest[]) => void
): () => void {
  return db
    .collection('channelJoinRequests')
    .where('requesterId', '==', uid)
    .onSnapshot((snap) => {
      callback(snap.docs.map((d) => d.data() as ChannelJoinRequest));
    });
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
    const unsub = db
      .collection('users')
      .where('__name__', 'in', batch)
      .onSnapshot((snap) => {
        for (const d of snap.docs) {
          allUsers.set(d.id, d.data() as User);
        }
        callback(Array.from(allUsers.values()));
      });
    unsubscribes.push(unsub);
  }

  return () => unsubscribes.forEach((u) => u());
}
