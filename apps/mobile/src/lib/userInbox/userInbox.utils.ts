import { InteractionManager } from 'react-native';
import { router } from 'expo-router';
import type { Channel, Post, UserInboxItem } from '@/models/types';
import { withNotificationsEntry } from '@/lib/navigation/entryNavigation.utils';
import { markUserInboxItemRead } from '@/services/firebase/firestore';
import { dismissNotificationsByData } from '@/services/notifications';

const itemHasPostId = (item: UserInboxItem): item is UserInboxItem & { postId: string } => {
  return 'postId' in item && typeof item.postId === 'string';
};

const itemHasChannelId = (item: UserInboxItem): item is UserInboxItem & { channelId: string } => {
  return 'channelId' in item && typeof item.channelId === 'string';
};

const isChannelActive = (channel: Channel | undefined): boolean => {
  return channel != null && channel.markedForDeletionAt === null;
};

const isPostActive = (post: Post | undefined, channelsById: Map<string, Channel>): boolean => {
  if (post == null || post.markedForDeletionAt !== null || post.status !== 'ready') {
    return false;
  }
  return isChannelActive(channelsById.get(post.channelId));
};

export function isUserInboxItemValid(
  item: UserInboxItem,
  postsById: Map<string, Post>,
  channelsById: Map<string, Channel>,
): boolean {
  if (itemHasPostId(item)) {
    return isPostActive(postsById.get(item.postId), channelsById);
  }
  if (itemHasChannelId(item)) {
    return isChannelActive(channelsById.get(item.channelId));
  }
  return true;
}

export function partitionUserInboxItems(
  items: UserInboxItem[],
  posts: Post[],
  channels: Channel[],
): { validItems: UserInboxItem[]; staleItemIds: string[] } {
  const postsById = new Map(posts.map((post) => [post.id, post] as const));
  const channelsById = new Map(channels.map((channel) => [channel.id, channel] as const));
  const validItems: UserInboxItem[] = [];
  const staleItemIds: string[] = [];

  items.forEach((item) => {
    if (isUserInboxItemValid(item, postsById, channelsById)) {
      validItems.push(item);
      return;
    }
    staleItemIds.push(item.id);
  });

  return { validItems, staleItemIds };
}

function scheduleInboxItemRead(userId: string, itemId: string): void {
  InteractionManager.runAfterInteractions(() => {
    void markUserInboxItemRead(userId, itemId).catch(() => {});
  });
}

export function getUserInboxItemLabel(item: UserInboxItem): string {
  switch (item.type) {
  case 'comment_reply':
    return `${item.senderFirstName} replied to your message`;
  case 'new_post': {
    const name = `${item.authorFirstName} ${item.authorLastName}`.trim();
    return `${name || 'Someone'} shared a new post in ${item.isDaily ? 'Daily Circle' : item.channelName}`;
  }
  case 'private_note_reply':
    return `${item.senderFirstName} replied in a private note`;
  case 'connection_accepted':
    return `${item.toFirstName} ${item.toLastName} accepted your connection request`;
  case 'join_channel_accepted':
    return `You were accepted into ${item.channelName}`;
  case 'custom_circle_invite':
    return `${item.inviterFirstName} invited you to join ${item.channelName}`;
  case 'connection_request':
    return `${item.fromFirstName} ${item.fromLastName} wants to connect`;
  case 'join_channel_request':
    return `${item.requesterFirstName} wants to join ${item.channelName}`;
  default:
    return 'New activity';
  }
}

export function getUserInboxItemPreview(item: UserInboxItem): string | null {
  if (item.type === 'comment_reply' || item.type === 'private_note_reply') {
    return item.messagePreview;
  }
  return null;
}

export async function openUserInboxItem(
  userId: string,
  item: UserInboxItem,
): Promise<void> {
  const entryParams = withNotificationsEntry({ inboxItemId: item.id });

  switch (item.type) {
  case 'comment_reply':
    void dismissNotificationsByData({ type: 'comment_reply', postId: item.postId }).catch(() => {});
    router.push({
      pathname: '/(protected)/conversation',
      params: { postId: item.postId, ...entryParams },
    });
    break;
  case 'new_post':
    void dismissNotificationsByData({ type: 'new_post', postId: item.postId }).catch(() => {});
    router.push({
      pathname: '/(protected)/post/[id]',
      params: { id: item.postId, ...entryParams },
    });
    break;
  case 'private_note_reply':
    void dismissNotificationsByData({ type: 'private_note_reply', postId: item.postId, noteId: item.noteId }).catch(() => {});
    router.push({
      pathname: '/(protected)/private-note-thread/[postId]/[noteId]',
      params: { postId: item.postId, noteId: item.noteId, ...entryParams },
    });
    break;
  case 'connection_accepted':
    router.push({
      pathname: '/(protected)/my-people',
      params: entryParams,
    });
    break;
  case 'join_channel_accepted':
    router.push({
      pathname: '/(protected)/channel-accepted',
      params: { channelName: item.channelName, ...entryParams },
    });
    break;
  case 'custom_circle_invite':
    router.push({
      pathname: '/(protected)/circle-invite/[id]',
      params: { id: item.requestId, ...entryParams },
    } as never);
    break;
  case 'connection_request':
    router.push({
      pathname: '/(protected)/connection-request/[id]',
      params: { id: item.connectionRequestId, ...entryParams },
    });
    break;
  case 'join_channel_request':
    router.push({
      pathname: '/(protected)/join-request/[id]',
      params: { id: item.joinRequestId, ...entryParams },
    });
    break;
  default:
    return;
  }

  scheduleInboxItemRead(userId, item.id);
}
