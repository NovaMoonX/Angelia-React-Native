import { InteractionManager } from 'react-native';
import { router } from 'expo-router';
import type { Channel, Post, User, UserInboxItem } from '@/models/types';
import { POST_TIERS } from '@/models/constants';
import { withNotificationsEntry } from '@/lib/navigation/entryNavigation.utils';
import { getPostPreviewText } from '@/lib/message/messagePreview.utils';
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

export interface UserInboxItemMetaChip {
  emoji: string;
  label: string;
  badgeBg: string | null;
  badgeText: string | null;
}

export interface UserInboxItemDisplayContext {
  post?: Post | null;
  channel?: Channel | null;
  usersById?: Record<string, User>;
  currentUserId?: string;
}

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

export function formatInboxPersonName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const last = lastName.trim();
  if (!first && !last) {
    return 'Someone';
  }
  if (!last) {
    return first;
  }
  return `${first} ${last[0]}.`;
}

export interface UserInboxItemRenderOptions {
  /** When true, post context is shown in a parent card header — skip redundant post previews. */
  groupedUnderYourPost?: boolean;
}

export function getUserInboxItemLabel(item: UserInboxItem): string {
  switch (item.type) {
  case 'comment_reply':
    return `${formatInboxPersonName(item.senderFirstName, item.senderLastName)} replied to your message`;
  case 'new_post':
    return `${formatInboxPersonName(item.authorFirstName, item.authorLastName)} shared a new post`;
  case 'private_note_reply':
    return `${formatInboxPersonName(item.senderFirstName, item.senderLastName)} replied in a private note`;
  case 'post_reaction':
    return `${formatInboxPersonName(item.reactorFirstName, item.reactorLastName)} reacted to your post`;
  case 'conversation_message':
    return `${formatInboxPersonName(item.senderFirstName, item.senderLastName)} sent a message on your post`;
  case 'private_note':
    return `${formatInboxPersonName(item.authorFirstName, item.authorLastName)} sent you a private note`;
  case 'connection_accepted':
    return `${formatInboxPersonName(item.toFirstName, item.toLastName)} accepted your connection request`;
  case 'join_channel_accepted':
    return `You were accepted into ${item.channelName}`;
  case 'custom_circle_invite':
    return `${formatInboxPersonName(item.inviterFirstName, item.inviterLastName)} invited you to join ${item.channelName}`;
  case 'connection_request':
    return `${formatInboxPersonName(item.fromFirstName, item.fromLastName)} wants to connect`;
  case 'join_channel_request':
    return `${formatInboxPersonName(item.requesterFirstName, item.requesterLastName)} wants to join ${item.channelName}`;
  default:
    return 'New activity';
  }
}

export function getUserInboxItemPreview(
  item: UserInboxItem,
  context?: UserInboxItemDisplayContext,
  options?: UserInboxItemRenderOptions,
): string | null {
  switch (item.type) {
  case 'comment_reply':
  case 'private_note_reply':
  case 'conversation_message':
    return item.messagePreview;
  case 'post_reaction':
    return `${item.emoji} reacted`;
  case 'new_post': {
    if (options?.groupedUnderYourPost) {
      return null;
    }
    if (item.postTextPreview) {
      return item.postTextPreview;
    }
    const postPreview = getPostPreviewText(context?.post);
    if (postPreview) {
      return postPreview;
    }
    if (item.hasAttachments) {
      return 'Includes a photo or video';
    }
    return null;
  }
  case 'private_note':
    return 'Tap to read their note';
  default:
    return null;
  }
}

export function getUserInboxItemMeta(
  item: UserInboxItem,
  context?: UserInboxItemDisplayContext,
): UserInboxItemMetaChip[] {
  switch (item.type) {
  case 'new_post': {
    const chips: UserInboxItemMetaChip[] = [];
    if (item.tier !== 'everyday') {
      const tierDef = POST_TIERS.find((entry) => {
        return entry.value === item.tier;
      });
      if (tierDef) {
        chips.push({
          emoji: tierDef.emoji,
          label: tierDef.label,
          badgeBg: tierDef.badgeBg === 'transparent' ? null : tierDef.badgeBg,
          badgeText: tierDef.badgeText === 'transparent' ? null : tierDef.badgeText,
        });
      }
    }
    if (item.hasAttachments) {
      chips.push({
        emoji: '📎',
        label: 'Includes media',
        badgeBg: null,
        badgeText: null,
      });
    }
    chips.push({
      emoji: item.isDaily ? '☀️' : '💫',
      label: item.isDaily ? 'Daily Circle' : item.channelName,
      badgeBg: null,
      badgeText: null,
    });
    return chips;
  }
  case 'custom_circle_invite':
    return [{
      emoji: '💫',
      label: item.channelName,
      badgeBg: null,
      badgeText: null,
    }];
  case 'join_channel_accepted':
  case 'join_channel_request':
    return [{
      emoji: '💫',
      label: item.channelName,
      badgeBg: null,
      badgeText: null,
    }];
  case 'post_reaction':
    return [{
      emoji: item.emoji,
      label: 'Reaction',
      badgeBg: null,
      badgeText: null,
    }];
  default:
    return [];
  }
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
    scheduleInboxItemRead(userId, item.id);
    break;
  case 'join_channel_accepted':
    router.push({
      pathname: '/(protected)/channel-accepted',
      params: { channelName: item.channelName, ...entryParams },
    });
    scheduleInboxItemRead(userId, item.id);
    break;
  case 'custom_circle_invite':
    router.push({
      pathname: '/(protected)/circle-invite/[id]',
      params: { id: item.requestId, ...entryParams },
    } as never);
    scheduleInboxItemRead(userId, item.id);
    break;
  case 'connection_request':
    router.push({
      pathname: '/(protected)/connection-request/[id]',
      params: { id: item.connectionRequestId, ...entryParams },
    });
    scheduleInboxItemRead(userId, item.id);
    break;
  case 'join_channel_request':
    router.push({
      pathname: '/(protected)/join-request/[id]',
      params: { id: item.joinRequestId, ...entryParams },
    });
    scheduleInboxItemRead(userId, item.id);
    break;
  default:
    break;
  }
}
