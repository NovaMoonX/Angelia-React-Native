import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectComments, setComments } from '@/store/slices/commentsSlice';
import { subscribeToComments } from '@/services/firebase/firestore';
import type { Comment } from '@/models/types';

/**
 * Subscribes to the `posts/{postId}/comments` subcollection and keeps the
 * Redux `commentsSlice` up to date. In demo mode the Firestore subscription
 * is skipped — demo comments are already loaded into the store.
 *
 * @param postId - The post whose comments should be loaded. Accepts null/undefined (no-op).
 * @returns An object containing the current comments array for that post (stable empty array when unloaded).
 */
export function usePostComments({ postId }: { postId: string | null | undefined }): { comments: Comment[] } {
  const dispatch = useAppDispatch();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const comments = useAppSelector((state) => selectComments(state, postId ?? ''));

  useEffect(() => {
    if (!postId || isDemo) return;
    const unsub = subscribeToComments(postId, (incoming) => {
      dispatch(setComments({ postId, comments: incoming }));
    });
    return unsub;
  }, [postId, isDemo, dispatch]);

  return { comments };
}
