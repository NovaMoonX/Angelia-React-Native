import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectPrivateNotesForPost, setPrivateNotes } from '@/store/slices/privateNotesSlice';
import { subscribeToPrivateNotesForPost } from '@/services/firebase/firestore';
import type { PrivateNote } from '@/models/types';

/**
 * Subscribes to private notes addressed to `hostId` for the given `postId`
 * and keeps the Redux `privateNotesSlice` up to date.
 *
 * Should only be called when the current user IS the post author (Host).
 * In demo mode the Firestore subscription is skipped.
 *
 * @returns The current private notes array for that post.
 */
export function usePrivateNotes({
  postId,
  hostId,
}: {
  postId: string | null | undefined;
  hostId: string | null | undefined;
}): { notes: PrivateNote[] } {
  const dispatch = useAppDispatch();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const notes = useAppSelector((state) => selectPrivateNotesForPost(state, postId ?? ''));

  useEffect(() => {
    if (!postId || !hostId || isDemo) return;
    const unsub = subscribeToPrivateNotesForPost(hostId, postId, (incoming) => {
      dispatch(setPrivateNotes({ postId, notes: incoming }));
    });
    return unsub;
  }, [postId, hostId, isDemo, dispatch]);

  return { notes };
}
