import { createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { CommentReplyNotification, ConversationMessageNotification, Message } from '@/models/types';
import {
  addMessage as firestoreAddMessage,
  updateMessageText as firestoreUpdateMessageText,
  createAppNotification,
} from '@/services/firebase/firestore';
import {
  addMessageOptimistic,
  removeMessagesOptimistic,
  updateMessageTextOptimistic,
} from '@/store/slices/conversationSlice';
import { generateId } from '@/utils/generateId';
import { buildTextPreview } from '@/lib/message/messagePreview.utils';
import { acquirePendingWrite, releasePendingWrite } from '@/lib/pendingWrites';
import { resolveMessageLineage } from '@/lib/conversation/threadLineage';
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
    const post = state.posts.items.find((item) => {
      return item.id === postId;
    });
    const isHost = post?.authorId === user.id;
    const existingMessages = state.conversation.messagesByPost[postId] ?? [];
    const parentMessage = parentId
      ? existingMessages.find((existingMessage) => {
          return existingMessage.id === parentId;
        })
      : null;
    const replyTargetUserId =
      parentMessage && parentMessage.authorId !== user.id ? parentMessage.authorId : null;
    const shouldNotifyPostAuthor =
      !!post &&
      post.authorId !== user.id &&
      (replyTargetUserId === null || post.authorId !== replyTargetUserId);
    const hasExistingNonSystemMessage = existingMessages.some((existingMessage) => {
      return existingMessage.authorId === user.id && !existingMessage.isSystem;
    });
    const shouldSendJoinMessage = !isHost && !hasExistingNonSystemMessage;
    let latestReactionEmoji: string | null = null;
    const reactions = post?.reactions ?? [];
    for (let reactionIndex = reactions.length - 1; reactionIndex >= 0; reactionIndex--) {
      if (reactions[reactionIndex].userId === user.id) {
        latestReactionEmoji = reactions[reactionIndex].emoji;
        break;
      }
    }
    const joinEmoji = latestReactionEmoji ?? '✨';
    const now = Date.now();

    const messageId = generateId('nano');
    const lineage = resolveMessageLineage(parentId, new Map(existingMessages.map((item) => [item.id, item])));
    const message: Message = {
      id: messageId,
      authorId: user.id,
      text: text.trim(),
      timestamp: now,
      parentId,
      rootId: lineage.rootId,
      grandparentId: lineage.grandparentId,
      reactions: {},
    };
    const joinMessage: Message | null = shouldSendJoinMessage
      ? {
          id: generateId('nano'),
          authorId: user.id,
          text: `joined the conversation with ${joinEmoji}`,
          timestamp: now - 1,
          parentId: null,
          reactions: {},
          isSystem: true,
        }
      : null;

    const optimisticMessageIds = [message.id];
    if (joinMessage) {
      optimisticMessageIds.unshift(joinMessage.id);
      dispatch(addMessageOptimistic({ postId, message: joinMessage }));
    }

    dispatch(addMessageOptimistic({ postId, message }));
    acquirePendingWrite(postId, 'message');

    if (isDemoActive(getState)) {
      releasePendingWrite(postId, 'message');
      return message;
    }

    try {
      if (joinMessage) {
        await firestoreAddMessage(postId, joinMessage);
      }
      await firestoreAddMessage(postId, message);

      const messagePreview = buildTextPreview(message.text, 'New message') ?? 'New message';

      if (replyTargetUserId && parentMessage) {
        const replyNotification: CommentReplyNotification = {
          id: generateId('nano'),
          type: 'comment_reply',
          actorId: user.id,
          target: { type: 'user', userId: replyTargetUserId },
          createdAt: Date.now(),
          postId,
          parentMessageId: parentMessage.id,
          senderFirstName: user.firstName,
          senderLastName: user.lastName,
          messagePreview,
        };
        createAppNotification(replyNotification).catch(() => {});
      }

      if (shouldNotifyPostAuthor && post) {
        const messageNotification: ConversationMessageNotification = {
          id: generateId('nano'),
          type: 'conversation_message',
          actorId: user.id,
          target: { type: 'user', userId: post.authorId },
          createdAt: Date.now(),
          postId,
          senderFirstName: user.firstName,
          senderLastName: user.lastName,
          messagePreview,
        };
        createAppNotification(messageNotification).catch(() => {});
      }

      releasePendingWrite(postId, 'message');
      return message;
    } catch (err) {
      dispatch(removeMessagesOptimistic({ postId, messageIds: optimisticMessageIds }));
      releasePendingWrite(postId, 'message');
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
    acquirePendingWrite(postId, 'message');

    if (isDemoActive(getState)) {
      releasePendingWrite(postId, 'message');
      return message;
    }

    try {
      await firestoreAddMessage(postId, message);
      releasePendingWrite(postId, 'message');
      return message;
    } catch (err) {
      dispatch(removeMessagesOptimistic({ postId, messageIds: [message.id] }));
      releasePendingWrite(postId, 'message');
      return rejectWithValue(
        err instanceof Error ? err.message : 'Failed to send join message',
      );
    }
  },
);

/**
 * Edit an existing chat message in a post conversation.
 */
export const editMessage = createAsyncThunk(
  'conversation/editMessage',
  async (
    {
      postId,
      messageId,
      text,
    }: { postId: string; messageId: string; text: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) {
      return rejectWithValue('User not authenticated');
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return rejectWithValue('Message text cannot be empty');
    }

    const existingMessages = state.conversation.messagesByPost[postId] ?? [];
    const targetMessage = existingMessages.find((existingMessage) => {
      return existingMessage.id === messageId;
    });

    if (!targetMessage) {
      return rejectWithValue('Message not found');
    }
    if (targetMessage.authorId !== user.id) {
      return rejectWithValue('You can only edit your own messages');
    }
    if (targetMessage.isSystem) {
      return rejectWithValue('System messages cannot be edited');
    }

    const previousText = targetMessage.text;

    dispatch(updateMessageTextOptimistic({ postId, messageId, text: trimmedText }));

    if (isDemoActive(getState)) {
      return { postId, messageId, text: trimmedText };
    }

    try {
      await firestoreUpdateMessageText(postId, messageId, trimmedText);
      return { postId, messageId, text: trimmedText };
    } catch (err) {
      dispatch(updateMessageTextOptimistic({ postId, messageId, text: previousText }));
      return rejectWithValue(
        err instanceof Error ? err.message : 'Failed to edit message',
      );
    }
  },
);
