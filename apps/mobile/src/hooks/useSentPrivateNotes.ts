import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectSentPrivateNotesForPost,
  selectPrivateNotesForPost,
  setSentPrivateNotes,
} from '@/store/slices/privateNotesSlice';
import { subscribeToMyPrivateNotesForPost } from '@/services/firebase/firestore';
import type { PrivateNote } from '@/models/types';

/**
 * Subscribes to the private notes written by the current user for the given
 * `postId` and keeps the Redux `sentNotesByPost` slice up to date.
 *
 * Should only be called when the current user is NOT the post host (visitor).
 * In demo mode the Firestore subscription is skipped; optimistically-added
 * notes already in `notesByPost` are surfaced directly instead.
 *
 * Intentionally does NOT clear `sentNotesByPost` on unmount — the data is keyed
 * by `postId` so stale entries for other posts are harmless, and clearing on
 * unmount would cause the badge in `post/[id].tsx` to disappear when navigating
 * to/from the sender notes screen while `post/[id].tsx` is still mounted.
 */
export function useSentPrivateNotes({
  postId,
}: {
  postId: string | null | undefined;
}): { sentNotes: PrivateNote[] } {
  const dispatch = useAppDispatch();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const sentNotes = useAppSelector((state) =>
    selectSentPrivateNotesForPost(state, postId ?? ''),
  );
  // In demo mode, surface optimistic notes from notesByPost filtered by author.
  const allNotesForPost = useAppSelector((state) =>
    selectPrivateNotesForPost(state, postId ?? ''),
  );
  const demoSentNotes = useMemo(
    () => (isDemo && currentUser ? allNotesForPost.filter((n) => { return n.authorId === currentUser.id; }) : []),
    [isDemo, currentUser, allNotesForPost],
  );

  useEffect(() => {
    if (!postId || !currentUser || isDemo) return;

    const unsub = subscribeToMyPrivateNotesForPost(
      postId,
      currentUser.id,
      (incoming) => {
        dispatch(setSentPrivateNotes({ postId, notes: incoming }));
      },
    );

    return () => {
      unsub();
    };
  }, [postId, currentUser, isDemo, dispatch]);

  return { sentNotes: isDemo ? demoSentNotes : sentNotes };
}
