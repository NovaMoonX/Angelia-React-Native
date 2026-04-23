import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { PrivateNote } from '@/models/types';
import { createPrivateNote } from '@/services/firebase/firestore';
import { addPrivateNoteOptimistic, removePrivateNoteOptimistic } from '@/store/slices/privateNotesSlice';
import { generateId } from '@/utils/generateId';
import { isDemoActive } from './globalActions';

/**
 * Sends a private note from the current user (visitor) to the post's Host.
 * Optimistically adds the note to the Redux store and writes to Firestore.
 */
export const sendPrivateNote = createAsyncThunk(
  'privateNotes/sendPrivateNote',
  async (
    { postId, hostId, text }: { postId: string; hostId: string; text: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const currentUser = state.users.currentUser;

    if (!currentUser) {
      return rejectWithValue('User not authenticated');
    }

    const note: PrivateNote = {
      id: generateId('nano'),
      postId,
      authorId: currentUser.id,
      hostId,
      text: text.trim(),
      timestamp: Date.now(),
    };

    dispatch(addPrivateNoteOptimistic({ postId, note }));

    if (isDemoActive(getState)) {
      return note;
    }

    try {
      await createPrivateNote(note);
      return note;
    } catch (err) {
      dispatch(removePrivateNoteOptimistic({ postId, noteId: note.id }));
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to send note');
    }
  },
);
