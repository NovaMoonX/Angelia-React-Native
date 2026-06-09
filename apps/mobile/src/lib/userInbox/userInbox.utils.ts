import { router } from 'expo-router';
import type { UserInboxItem } from '@/models/types';
import { markUserInboxItemRead } from '@/services/firebase/firestore';
import { dismissNotificationsByData } from '@/services/notifications';

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
  await markUserInboxItemRead(userId, item.id).catch(() => {});

  switch (item.type) {
  case 'comment_reply':
    void dismissNotificationsByData({ type: 'comment_reply', postId: item.postId }).catch(() => {});
    router.push({ pathname: '/(protected)/conversation', params: { postId: item.postId } });
    return;
  case 'new_post':
    void dismissNotificationsByData({ type: 'new_post', postId: item.postId }).catch(() => {});
    router.push({ pathname: '/(protected)/post/[id]', params: { id: item.postId } });
    return;
  case 'private_note_reply':
    void dismissNotificationsByData({ type: 'private_note_reply', postId: item.postId, noteId: item.noteId }).catch(() => {});
    router.push({
      pathname: '/(protected)/private-note-thread/[postId]/[noteId]',
      params: { postId: item.postId, noteId: item.noteId },
    });
    return;
  case 'connection_accepted':
    router.push('/(protected)/my-people');
    return;
  case 'join_channel_accepted':
    router.push({ pathname: '/(protected)/channel-accepted', params: { channelName: item.channelName } });
    return;
  case 'custom_circle_invite':
    router.push({ pathname: '/(protected)/circle-invite/[id]', params: { id: item.requestId } } as never);
    return;
  case 'connection_request':
    router.push({ pathname: '/(protected)/connection-request/[id]', params: { id: item.connectionRequestId } });
    return;
  case 'join_channel_request':
    router.push({ pathname: '/(protected)/join-request/[id]', params: { id: item.joinRequestId } });
    return;
  default:
    return;
  }
}
