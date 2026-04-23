import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { PrivateNote } from '@/models/types';
import type { RootState } from '../index';
import { resetAllState } from '../actions/globalActions';

interface PrivateNotesState {
  /** Private notes keyed by postId. Only populated for posts the current user hosts. */
  notesByPost: Record<string, PrivateNote[]>;
}

const initialState: PrivateNotesState = {
  notesByPost: {},
};

const privateNotesSlice = createSlice({
  name: 'privateNotes',
  initialState,
  reducers: {
    setPrivateNotes(
      state,
      action: PayloadAction<{ postId: string; notes: PrivateNote[] }>,
    ) {
      state.notesByPost[action.payload.postId] = action.payload.notes;
    },
    addPrivateNoteOptimistic(
      state,
      action: PayloadAction<{ postId: string; note: PrivateNote }>,
    ) {
      const { postId, note } = action.payload;
      if (!state.notesByPost[postId]) {
        state.notesByPost[postId] = [];
      }
      if (!state.notesByPost[postId].some((n) => n.id === note.id)) {
        state.notesByPost[postId].push(note);
      }
    },
    removePrivateNoteOptimistic(
      state,
      action: PayloadAction<{ postId: string; noteId: string }>,
    ) {
      const { postId, noteId } = action.payload;
      if (state.notesByPost[postId]) {
        state.notesByPost[postId] = state.notesByPost[postId].filter(
          (n) => n.id !== noteId,
        );
      }
    },
    clearPrivateNotes(state, action: PayloadAction<string>) {
      delete state.notesByPost[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setPrivateNotes,
  addPrivateNoteOptimistic,
  removePrivateNoteOptimistic,
  clearPrivateNotes,
} = privateNotesSlice.actions;

// Selectors
const EMPTY_NOTES: PrivateNote[] = [];

export const selectPrivateNotesForPost = createSelector(
  [
    (state: RootState) => state.privateNotes.notesByPost,
    (_state: RootState, postId: string) => postId,
  ],
  (notesByPost, postId) => notesByPost[postId] ?? EMPTY_NOTES,
);

export default privateNotesSlice.reducer;
