import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { Message, PrivateNote } from '@/models/types';
import type { RootState } from '../index';
import { resetAllState } from '../actions/globalActions';

export const getPrivateNoteThreadKey = (postId: string, noteId: string) => `${postId}:${noteId}`;

interface PrivateNotesState {
  /** Private notes keyed by postId. Only populated for posts the current user hosts. */
  notesByPost: Record<string, PrivateNote[]>;
  /** Private notes sent BY the current user, keyed by postId. Only populated when the user is a visitor. */
  sentNotesByPost: Record<string, PrivateNote[]>;
  /** Thread replies keyed by `${postId}:${noteId}`. */
  threadMessagesByKey: Record<string, Message[]>;
}

const initialState: PrivateNotesState = {
  notesByPost: {},
  sentNotesByPost: {},
  threadMessagesByKey: {},
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
    loadDemoPrivateNotes(state, action: PayloadAction<Record<string, PrivateNote[]>>) {
      state.notesByPost = { ...state.notesByPost, ...action.payload };
    },
    /** Replaces the current user's sent notes for a post (used by the visitor subscription). */
    setSentPrivateNotes(
      state,
      action: PayloadAction<{ postId: string; notes: PrivateNote[] }>,
    ) {
      state.sentNotesByPost[action.payload.postId] = action.payload.notes;
    },
    clearSentPrivateNotes(state, action: PayloadAction<string>) {
      delete state.sentNotesByPost[action.payload];
    },
    setPrivateNoteThreadMessages(
      state,
      action: PayloadAction<{ postId: string; noteId: string; messages: Message[] }>,
    ) {
      const key = getPrivateNoteThreadKey(action.payload.postId, action.payload.noteId);
      state.threadMessagesByKey[key] = action.payload.messages;
    },
    addPrivateNoteThreadMessageOptimistic(
      state,
      action: PayloadAction<{ postId: string; noteId: string; message: Message }>,
    ) {
      const key = getPrivateNoteThreadKey(action.payload.postId, action.payload.noteId);
      if (!state.threadMessagesByKey[key]) {
        state.threadMessagesByKey[key] = [];
      }
      if (!state.threadMessagesByKey[key].some((m) => m.id === action.payload.message.id)) {
        state.threadMessagesByKey[key].push(action.payload.message);
      }
    },
    removePrivateNoteThreadMessageOptimistic(
      state,
      action: PayloadAction<{ postId: string; noteId: string; messageId: string }>,
    ) {
      const key = getPrivateNoteThreadKey(action.payload.postId, action.payload.noteId);
      if (!state.threadMessagesByKey[key]) {
        return;
      }
      state.threadMessagesByKey[key] = state.threadMessagesByKey[key].filter((m) => {
        return m.id !== action.payload.messageId;
      });
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
  loadDemoPrivateNotes,
  setSentPrivateNotes,
  clearSentPrivateNotes,
  setPrivateNoteThreadMessages,
  addPrivateNoteThreadMessageOptimistic,
  removePrivateNoteThreadMessageOptimistic,
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

export const selectSentPrivateNotesForPost = createSelector(
  [
    (state: RootState) => state.privateNotes.sentNotesByPost,
    (_state: RootState, postId: string) => postId,
  ],
  (sentNotesByPost, postId) => sentNotesByPost[postId] ?? EMPTY_NOTES,
);

const EMPTY_THREAD_MESSAGES: Message[] = [];

export const selectPrivateNoteThreadMessages = createSelector(
  [
    (state: RootState) => state.privateNotes.threadMessagesByKey,
    (_state: RootState, postId: string, noteId: string) => getPrivateNoteThreadKey(postId, noteId),
  ],
  (threadMessagesByKey, key) => threadMessagesByKey[key] ?? EMPTY_THREAD_MESSAGES,
);

export const selectPrivateNoteById = createSelector(
  [
    (state: RootState) => state.privateNotes.notesByPost,
    (state: RootState) => state.privateNotes.sentNotesByPost,
    (_state: RootState, postId: string, noteId: string) => postId,
    (_state: RootState, _postId: string, noteId: string) => noteId,
  ],
  (notesByPost, sentNotesByPost, postId, noteId) => {
    const hosted = notesByPost[postId]?.find((note) => note.id === noteId);
    if (hosted) {
      return hosted;
    }
    return sentNotesByPost[postId]?.find((note) => note.id === noteId) ?? null;
  },
);

export default privateNotesSlice.reducer;
