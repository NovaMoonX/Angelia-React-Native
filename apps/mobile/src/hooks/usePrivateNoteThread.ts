import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  selectPrivateNoteThreadMessages,
  setPrivateNoteThreadMessages,
} from '@/store/slices/privateNotesSlice';
import { subscribeToPrivateNoteThreadMessages } from '@/services/firebase/firestore';

export function usePrivateNoteThread({
  postId,
  noteId,
}: {
  postId: string | null | undefined;
  noteId: string | null | undefined;
}): { messages: ReturnType<typeof selectPrivateNoteThreadMessages>; loaded: boolean } {
  const dispatch = useAppDispatch();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const messages = useAppSelector((state) =>
    selectPrivateNoteThreadMessages(state, postId ?? '', noteId ?? ''),
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!postId || !noteId || isDemo) {
      setLoaded(true);
      return;
    }

    setLoaded(false);
    const unsub = subscribeToPrivateNoteThreadMessages(
      postId,
      noteId,
      (incoming) => {
        dispatch(setPrivateNoteThreadMessages({ postId, noteId, messages: incoming }));
        setLoaded(true);
      },
      () => {
        setLoaded(true);
      },
    );

    return () => {
      unsub();
      setLoaded(false);
    };
  }, [postId, noteId, isDemo, dispatch]);

  return { messages, loaded };
}
