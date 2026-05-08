import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { Message } from '@/models/types';
import type { RootState } from '../index';
import { resetAllState } from '../actions/globalActions';

interface ConversationState {
  /** Messages keyed by postId. */
  messagesByPost: Record<string, Message[]>;
}

const initialState: ConversationState = {
  messagesByPost: {},
};

const conversationSlice = createSlice({
  name: 'conversation',
  initialState,
  reducers: {
    setMessages(
      state,
      action: PayloadAction<{ postId: string; messages: Message[] }>,
    ) {
      state.messagesByPost[action.payload.postId] = action.payload.messages;
    },
    addMessageOptimistic(
      state,
      action: PayloadAction<{ postId: string; message: Message }>,
    ) {
      const { postId, message } = action.payload;
      if (!state.messagesByPost[postId]) {
        state.messagesByPost[postId] = [];
      }
      // Avoid duplicates (in case subscription beats optimistic update)
      if (!state.messagesByPost[postId].some((m) => m.id === message.id)) {
        state.messagesByPost[postId].push(message);
      }
    },
    clearConversation(state, action: PayloadAction<string>) {
      delete state.messagesByPost[action.payload];
    },
    loadDemoMessages(
      state,
      action: PayloadAction<Record<string, Message[]>>,
    ) {
      state.messagesByPost = { ...state.messagesByPost, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const { setMessages, addMessageOptimistic, clearConversation, loadDemoMessages } =
  conversationSlice.actions;

// Selectors
const EMPTY_MESSAGES: Message[] = [];

export const selectMessages = createSelector(
  [(state: RootState) => state.conversation.messagesByPost, (_state: RootState, postId: string) => postId],
  (messagesByPost, postId) => messagesByPost[postId] ?? EMPTY_MESSAGES,
);

export default conversationSlice.reducer;
