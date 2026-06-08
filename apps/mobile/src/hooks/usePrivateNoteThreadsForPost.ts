import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setPrivateNoteThreadMessages } from '@/store/slices/privateNotesSlice';
import { subscribeToPrivateNoteThreadMessages } from '@/services/firebase/firestore';

/**
 * Subscribes to thread replies for each note on a post so unread state can be
 * computed on the post detail screen without opening every thread.
 */
export function usePrivateNoteThreadsForPost({
  postId,
  noteIds,
}: {
  postId: string | null | undefined;
  noteIds: string[];
}): void {
  const dispatch = useAppDispatch();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const noteIdsKey = useMemo(() => noteIds.join('|'), [noteIds]);

  useEffect(() => {
    if (!postId || isDemo || noteIds.length === 0) {
      return;
    }

    const unsubs = noteIds.map((noteId) => {
      return subscribeToPrivateNoteThreadMessages(postId, noteId, (messages) => {
        dispatch(setPrivateNoteThreadMessages({ postId, noteId, messages }));
      });
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [postId, noteIdsKey, isDemo, dispatch, noteIds]);
}
