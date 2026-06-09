import { useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';
import type { PrivateNote } from '@/models/types';

export function usePrivateNoteUnreadForPost({
  postId,
  currentUserId,
  isHost,
}: {
  postId: string | null | undefined;
  notes: PrivateNote[];
  currentUserId: string;
  isHost: boolean;
}): {
  hasUnreadNotes: boolean;
  hasUnreadReplies: boolean;
  hasUnreadActivity: boolean;
  noteIdsWithUnreadReplies: string[];
} {
  const inboxItems = useAppSelector((state) => state.userInbox.items);

  const hasUnreadNotes = useMemo(() => {
    if (!postId || !isHost) return false;
    return inboxItems.some((item) => {
      return item.readAt === null
        && item.surface === 'post_activity'
        && item.type === 'private_note'
        && 'postId' in item
        && item.postId === postId;
    });
  }, [inboxItems, isHost, postId]);

  const noteIdsWithUnreadReplies = useMemo(() => {
    if (!postId) return [];
    const noteIds = new Set<string>();
    inboxItems.forEach((item) => {
      if (item.readAt !== null) return;
      if (item.type !== 'private_note_reply') return;
      if (!('postId' in item) || item.postId !== postId) return;
      if (!('noteId' in item)) return;
      const isRelevant =
        (isHost && item.surface === 'post_activity')
        || (!isHost && item.surface === 'notifications');
      if (!isRelevant) return;
      noteIds.add(item.noteId);
    });
    return Array.from(noteIds);
  }, [inboxItems, isHost, postId]);

  const hasUnreadReplies = noteIdsWithUnreadReplies.length > 0;

  return {
    hasUnreadNotes,
    hasUnreadReplies,
    hasUnreadActivity: hasUnreadNotes || hasUnreadReplies,
    noteIdsWithUnreadReplies,
  };
}
