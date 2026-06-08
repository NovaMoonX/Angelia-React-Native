import { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useAppSelector } from '@/store/hooks';
import { getPrivateNoteThreadKey } from '@/store/slices/privateNotesSlice';
import type { PrivateNote } from '@/models/types';
import {
  PRIVATE_NOTES_SEEN_KEY,
  PRIVATE_NOTE_THREAD_SEEN_KEY,
} from '@/models/constants';
import type { Message } from '@/models/types';

function getLatestIncomingThreadTimestamp(
  messages: Message[],
  currentUserId: string,
): number {
  const incoming = messages.filter((message) => message.authorId !== currentUserId);
  if (incoming.length === 0) {
    return 0;
  }
  return Math.max(...incoming.map((message) => message.timestamp));
}

export function usePrivateNoteUnreadForPost({
  postId,
  notes,
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
  const threadMessagesByKey = useAppSelector((state) => state.privateNotes.threadMessagesByKey);
  const [hasUnreadNotes, setHasUnreadNotes] = useState(false);
  const [noteIdsWithUnreadReplies, setNoteIdsWithUnreadReplies] = useState<string[]>([]);

  const latestNoteTimestamp = useMemo(() => {
    if (notes.length === 0) {
      return 0;
    }
    return Math.max(...notes.map((note) => note.timestamp));
  }, [notes]);

  useFocusEffect(
    useCallback(() => {
      if (!postId || !currentUserId) {
        setHasUnreadNotes(false);
        setNoteIdsWithUnreadReplies([]);
        return;
      }

      let cancelled = false;

      const refreshUnreadState = async () => {
        let nextHasUnreadNotes = false;

        if (isHost && latestNoteTimestamp > 0) {
          const rawNotesSeen = await AsyncStorage.getItem(PRIVATE_NOTES_SEEN_KEY(postId)).catch(() => null);
          const notesSeenAt = rawNotesSeen ? Number(rawNotesSeen) : 0;
          nextHasUnreadNotes = latestNoteTimestamp > notesSeenAt;
        }

        const unreadReplyNoteIds: string[] = [];

        await Promise.all(
          notes.map(async (note) => {
            const threadKey = getPrivateNoteThreadKey(postId, note.id);
            const messages = threadMessagesByKey[threadKey] ?? [];
            const latestIncoming = getLatestIncomingThreadTimestamp(messages, currentUserId);
            if (latestIncoming === 0) {
              return;
            }

            const rawThreadSeen = await AsyncStorage.getItem(
              PRIVATE_NOTE_THREAD_SEEN_KEY(postId, note.id),
            ).catch(() => null);
            const threadSeenAt = rawThreadSeen ? Number(rawThreadSeen) : 0;
            if (latestIncoming > threadSeenAt) {
              unreadReplyNoteIds.push(note.id);
            }
          }),
        );

        if (cancelled) {
          return;
        }

        setHasUnreadNotes(nextHasUnreadNotes);
        setNoteIdsWithUnreadReplies(unreadReplyNoteIds);
      };

      void refreshUnreadState();

      return () => {
        cancelled = true;
      };
    }, [postId, currentUserId, isHost, latestNoteTimestamp, notes, threadMessagesByKey]),
  );

  const hasUnreadReplies = noteIdsWithUnreadReplies.length > 0;

  return {
    hasUnreadNotes,
    hasUnreadReplies,
    hasUnreadActivity: hasUnreadNotes || hasUnreadReplies,
    noteIdsWithUnreadReplies,
  };
}
