import { useEffect, useState } from 'react';
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
 * @returns The current private notes array for that post, a `loaded` flag
 *          that is `true` once the first snapshot (or error) has resolved,
 *          and `subscriptionFailed` which is `true` if Firestore rejected the query.
 */
export function usePrivateNotes({
  postId,
  hostId,
}: {
  postId: string | null | undefined;
  hostId: string | null | undefined;
}): { notes: PrivateNote[]; loaded: boolean; subscriptionFailed: boolean } {
  const dispatch = useAppDispatch();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const notes = useAppSelector((state) => selectPrivateNotesForPost(state, postId ?? ''));
  const [loaded, setLoaded] = useState(false);
  const [subscriptionFailed, setSubscriptionFailed] = useState(false);

  useEffect(() => {
    if (!postId || !hostId || isDemo) {
      setLoaded(true);
      return;
    }
    setLoaded(false);
    setSubscriptionFailed(false);
    const unsub = subscribeToPrivateNotesForPost(
      postId,
      (incoming) => {
        dispatch(setPrivateNotes({ postId, notes: incoming }));
        setLoaded(true);
        setSubscriptionFailed(false);
      },
      () => {
        setSubscriptionFailed(true);
        setLoaded(true);
      },
    );
    return () => {
      unsub();
      setLoaded(false);
      setSubscriptionFailed(false);
    };
  }, [postId, hostId, isDemo, dispatch]);

  return { notes, loaded, subscriptionFailed };
}
