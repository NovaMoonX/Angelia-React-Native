import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { subscribeToPrivateNote } from '@/services/firebase/firestore';
import type { PrivateNote } from '@/models/types';

/**
 * Loads a single private note straight from Firestore.
 *
 * The private note list hooks (`usePrivateNotes` / `useSentPrivateNotes`) only run
 * on the post detail and notes list screens, so a thread opened from a push
 * notification or inbox item has nothing in Redux to read. This hook gives the
 * thread screen its own source of truth.
 *
 * `loaded` flips to `true` after the first snapshot (or error) so callers can
 * tell "still loading" apart from "this note is not available".
 * In demo mode there is no Firestore — the caller falls back to the Redux copy.
 */
export function usePrivateNoteById({
  postId,
  noteId,
}: {
  postId: string | null | undefined;
  noteId: string | null | undefined;
}): { note: PrivateNote | null; loaded: boolean } {
  const isDemo = useAppSelector((state) => { return state.demo.isActive; });
  const [note, setNote] = useState<PrivateNote | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!postId || !noteId || isDemo) {
      setNote(null);
      setLoaded(true);
      return;
    }

    setNote(null);
    setLoaded(false);
    const unsub = subscribeToPrivateNote(
      postId,
      noteId,
      (incoming) => {
        setNote(incoming);
        setLoaded(true);
      },
      () => {
        setNote(null);
        setLoaded(true);
      },
    );

    return () => {
      unsub();
    };
  }, [postId, noteId, isDemo]);

  return { note, loaded };
}
