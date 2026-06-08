import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { Message, PrivateNoteReplyNotification } from '@/models/types';
import {
  addPrivateNoteThreadMessage,
  createAppNotification,
} from '@/services/firebase/firestore';
import {
  addPrivateNoteThreadMessageOptimistic,
  removePrivateNoteThreadMessageOptimistic,
  selectPrivateNoteById,
} from '@/store/slices/privateNotesSlice';
import { generateId } from '@/utils/generateId';
import { isDemoActive } from './globalActions';

function buildMessagePreview(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'New reply';
  }
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
}

export const sendPrivateNoteReply = createAsyncThunk(
  'privateNotes/sendPrivateNoteReply',
  async (
    { postId, noteId, text }: { postId: string; noteId: string; text: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const currentUser = state.users.currentUser;
    const note = selectPrivateNoteById(state, postId, noteId);

    if (!currentUser) {
      return rejectWithValue('User not authenticated');
    }
    if (!note) {
      return rejectWithValue('Private note not found');
    }

    const isParticipant =
      currentUser.id === note.hostId || currentUser.id === note.authorId;
    if (!isParticipant) {
      return rejectWithValue('Not allowed to reply in this thread');
    }

    const message: Message = {
      id: generateId('nano'),
      authorId: currentUser.id,
      text: text.trim(),
      timestamp: Date.now(),
      parentId: null,
      reactions: {},
    };

    dispatch(addPrivateNoteThreadMessageOptimistic({ postId, noteId, message }));

    if (isDemoActive(getState)) {
      return message;
    }

    try {
      await addPrivateNoteThreadMessage(postId, noteId, message);

      const recipientUserId =
        currentUser.id === note.hostId ? note.authorId : note.hostId;

      if (recipientUserId !== currentUser.id) {
        const notification: PrivateNoteReplyNotification = {
          id: generateId('nano'),
          type: 'private_note_reply',
          actorId: currentUser.id,
          target: { type: 'user', userId: recipientUserId },
          createdAt: Date.now(),
          postId,
          noteId,
          senderFirstName: currentUser.firstName,
          senderLastName: currentUser.lastName,
          messagePreview: buildMessagePreview(message.text),
        };
        createAppNotification(notification).catch(() => {});
      }

      return message;
    } catch (err) {
      dispatch(removePrivateNoteThreadMessageOptimistic({ postId, noteId, messageId: message.id }));
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to send reply');
    }
  },
);
