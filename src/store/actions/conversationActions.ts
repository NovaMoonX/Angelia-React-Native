import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { Message } from '@/models/types';
import { addMessage as firestoreAddMessage } from '@/services/firebase/firestore';
import { addMessageOptimistic } from '@/store/slices/conversationSlice';
import { generateId } from '@/utils/generateId';
import { isDemoActive } from './globalActions';

/**
 * Send a chat message to a post's conversation.
 */
export const sendMessage = createAsyncThunk(
  'conversation/sendMessage',
  async (
    {
      postId,
      text,
      parentId = null,
    }: { postId: string; text: string; parentId?: string | null },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    const message: Message = {
      id: generateId('nano'),
      authorId: user.id,
      text: text.trim(),
      timestamp: Date.now(),
      parentId,
      reactions: {},
    };

    dispatch(addMessageOptimistic({ postId, message }));

    if (isDemoActive(getState)) {
      return message;
    }

    try {
      await firestoreAddMessage(postId, message);
      return message;
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : 'Failed to send message',
      );
    }
  },
);

/**
 * Post a system-style "joined" message when a user enters the conversation.
 */
export const sendJoinMessage = createAsyncThunk(
  'conversation/sendJoinMessage',
  async (
    { postId, emoji }: { postId: string; emoji: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    const message: Message = {
      id: generateId('nano'),
      authorId: user.id,
      text: `joined the conversation with ${emoji}`,
      timestamp: Date.now(),
      parentId: null,
      reactions: {},
      isSystem: true,
    };

    dispatch(addMessageOptimistic({ postId, message }));

    if (isDemoActive(getState)) {
      return message;
    }

    try {
      await firestoreAddMessage(postId, message);
      return message;
    } catch (err) {
      return rejectWithValue(
        err instanceof Error ? err.message : 'Failed to send join message',
      );
    }
  },
);
