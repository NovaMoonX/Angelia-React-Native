import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { Message, PrivateNoteReplyNotification } from '@/models/types';
import {
  addPrivateNoteThreadMessage,
  updatePrivateNoteThreadMessageText,
  togglePrivateNoteThreadMessageReaction as firestoreTogglePrivateNoteThreadMessageReaction,
  deletePrivateNoteThreadMessage,
  createAppNotification,
} from '@/services/firebase/firestore';
import {
  addPrivateNoteThreadMessageOptimistic,
  removePrivateNoteThreadMessageOptimistic,
  updatePrivateNoteThreadMessageTextOptimistic,
  updatePrivateNoteThreadMessageReactionsOptimistic,
  setPrivateNoteThreadMessages,
  selectPrivateNoteById,
  selectPrivateNoteThreadMessages,
} from '@/store/slices/privateNotesSlice';
import { toggleMessageReactionMap } from '@/lib/message/messageReaction.utils';
import { generateId } from '@/utils/generateId';
import { buildTextPreview } from '@/lib/message/messagePreview.utils';
import { isDemoActive } from './globalActions';

const pendingPrivateNoteReactionKeys = new Set<string>();

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
          messagePreview: buildTextPreview(message.text, 'New reply') ?? 'New reply',
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

export const editPrivateNoteThreadMessage = createAsyncThunk(
  'privateNotes/editPrivateNoteThreadMessage',
  async (
    {
      postId,
      noteId,
      messageId,
      text,
    }: { postId: string; noteId: string; messageId: string; text: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const currentUser = state.users.currentUser;
    if (!currentUser) {
      return rejectWithValue('User not authenticated');
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return rejectWithValue('Message text cannot be empty');
    }

    const existingMessages = selectPrivateNoteThreadMessages(state, postId, noteId);
    const targetMessage = existingMessages.find((message) => message.id === messageId);
    if (!targetMessage) {
      return rejectWithValue('Message not found');
    }
    if (targetMessage.authorId !== currentUser.id) {
      return rejectWithValue('You can only edit your own messages');
    }

    const previousText = targetMessage.text;
    dispatch(updatePrivateNoteThreadMessageTextOptimistic({ postId, noteId, messageId, text: trimmedText }));

    if (isDemoActive(getState)) {
      return { postId, noteId, messageId, text: trimmedText };
    }

    try {
      await updatePrivateNoteThreadMessageText(postId, noteId, messageId, trimmedText);
      return { postId, noteId, messageId, text: trimmedText };
    } catch (err) {
      dispatch(updatePrivateNoteThreadMessageTextOptimistic({ postId, noteId, messageId, text: previousText }));
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to edit message');
    }
  },
);

export const togglePrivateNoteThreadMessageReaction = createAsyncThunk(
  'privateNotes/togglePrivateNoteThreadMessageReaction',
  async (
    {
      postId,
      noteId,
      messageId,
      emoji,
    }: { postId: string; noteId: string; messageId: string; emoji: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const currentUser = state.users.currentUser;
    if (!currentUser) {
      return rejectWithValue('User not authenticated');
    }

    const existingMessages = selectPrivateNoteThreadMessages(state, postId, noteId);
    const targetMessage = existingMessages.find((message) => message.id === messageId);
    if (!targetMessage) {
      return rejectWithValue('Message not found');
    }

    const reactionKey = `${postId}:${noteId}:${messageId}:${emoji}`;
    if (pendingPrivateNoteReactionKeys.has(reactionKey)) {
      return rejectWithValue('Reaction already in progress');
    }

    const previousReactions = targetMessage.reactions ?? {};
    const nextReactions = toggleMessageReactionMap(previousReactions, currentUser.id, emoji);

    pendingPrivateNoteReactionKeys.add(reactionKey);
    dispatch(updatePrivateNoteThreadMessageReactionsOptimistic({
      postId,
      noteId,
      messageId,
      reactions: nextReactions,
    }));

    if (isDemoActive(getState)) {
      pendingPrivateNoteReactionKeys.delete(reactionKey);
      return { postId, noteId, messageId, emoji };
    }

    try {
      await firestoreTogglePrivateNoteThreadMessageReaction(postId, noteId, messageId, currentUser.id, emoji);
      return { postId, noteId, messageId, emoji };
    } catch (err) {
      dispatch(updatePrivateNoteThreadMessageReactionsOptimistic({
        postId,
        noteId,
        messageId,
        reactions: previousReactions,
      }));
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to update reaction');
    } finally {
      pendingPrivateNoteReactionKeys.delete(reactionKey);
    }
  },
);

export const deletePrivateNoteThreadMessageAction = createAsyncThunk(
  'privateNotes/deletePrivateNoteThreadMessage',
  async (
    { postId, noteId, messageId }: { postId: string; noteId: string; messageId: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const currentUser = state.users.currentUser;
    if (!currentUser) {
      return rejectWithValue('User not authenticated');
    }

    const existingMessages = selectPrivateNoteThreadMessages(state, postId, noteId);
    const targetMessage = existingMessages.find((message) => message.id === messageId);
    if (!targetMessage) {
      return rejectWithValue('Message not found');
    }
    if (targetMessage.authorId !== currentUser.id) {
      return rejectWithValue('You can only delete your own messages');
    }

    dispatch(removePrivateNoteThreadMessageOptimistic({ postId, noteId, messageId }));

    if (isDemoActive(getState)) {
      return { postId, noteId, messageId };
    }

    try {
      await deletePrivateNoteThreadMessage(postId, noteId, messageId);
      return { postId, noteId, messageId };
    } catch (err) {
      dispatch(setPrivateNoteThreadMessages({ postId, noteId, messages: existingMessages }));
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to delete message');
    }
  },
);
