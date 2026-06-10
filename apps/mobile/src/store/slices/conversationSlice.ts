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
    updateMessageTextOptimistic(
      state,
      action: PayloadAction<{ postId: string; messageId: string; text: string }>,
    ) {
      const { postId, messageId, text } = action.payload;
      const messages = state.messagesByPost[postId];
      if (!messages) return;
      const target = messages.find((message) => {
        return message.id === messageId;
      });
      if (!target) return;
      target.text = text;
    },
    updateMessageReactionsOptimistic(
      state,
      action: PayloadAction<{
        postId: string;
        messageId: string;
        reactions: Record<string, string[]>;
      }>,
    ) {
      const { postId, messageId, reactions } = action.payload;
      const messages = state.messagesByPost[postId];
      if (!messages) {
        return;
      }
      const target = messages.find((message) => message.id === messageId);
      if (!target) {
        return;
      }
      target.reactions = reactions;
    },
    removeMessageOptimistic(
      state,
      action: PayloadAction<{ postId: string; messageId: string }>,
    ) {
      const { postId, messageId } = action.payload;
      const messages = state.messagesByPost[postId];
      if (!messages) {
        return;
      }
      state.messagesByPost[postId] = messages.filter((message) => message.id !== messageId);
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

export const {
  setMessages,
  addMessageOptimistic,
  updateMessageTextOptimistic,
  updateMessageReactionsOptimistic,
  removeMessageOptimistic,
  clearConversation,
  loadDemoMessages,
} = conversationSlice.actions;

// Selectors
const EMPTY_MESSAGES: Message[] = [];

export const selectMessages = createSelector(
  [(state: RootState) => state.conversation.messagesByPost, (_state: RootState, postId: string) => postId],
  (messagesByPost, postId) => messagesByPost[postId] ?? EMPTY_MESSAGES,
);

export default conversationSlice.reducer;
