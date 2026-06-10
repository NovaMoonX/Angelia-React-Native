import { useCallback, useMemo, useState } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { useActionModal } from '@/hooks/useActionModal';
import { useToast } from '@/hooks/useToast';
import {
  deleteConversationMessage,
  toggleConversationMessageReaction,
} from '@/store/actions/conversationActions';
import {
  deletePrivateNoteThreadMessageAction,
  togglePrivateNoteThreadMessageReaction,
} from '@/store/actions/privateNoteThreadActions';
import type { MessageActionId, MessageActionOption } from '@/components/conversation/MessageActionSheet';
import { isPersistedMessage } from '@/lib/message/messageReaction.utils';
import type { Message } from '@/models/types';

export type MessageActionContext =
  | { kind: 'conversation'; postId: string; canReply?: boolean }
  | { kind: 'privateNote'; postId: string; noteId: string };

interface UseMessageActionsOptions {
  context: MessageActionContext;
  currentUserId: string | undefined;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  canReplyToMessage?: (message: Message) => boolean;
}

export function useMessageActions({
  context,
  currentUserId,
  onReply,
  onEdit,
  canReplyToMessage,
}: UseMessageActionsOptions) {
  const dispatch = useAppDispatch();
  const { confirm } = useActionModal();
  const { addToast } = useToast();

  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [emojiPickerMessage, setEmojiPickerMessage] = useState<Message | null>(null);

  const openActions = useCallback((message: Message) => {
    if (message.isSystem || !isPersistedMessage(message)) {
      return;
    }
    setActionMessage(message);
  }, []);

  const closeActions = useCallback(() => {
    setActionMessage(null);
  }, []);

  const openReactionPicker = useCallback((message: Message) => {
    if (message.isSystem || !isPersistedMessage(message)) {
      return;
    }
    setEmojiPickerMessage(message);
  }, []);

  const closeReactionPicker = useCallback(() => {
    setEmojiPickerMessage(null);
  }, []);

  const toggleReaction = useCallback(async (message: Message, emoji: string) => {
    if (!currentUserId || message.isSystem || !isPersistedMessage(message)) {
      return;
    }

    try {
      if (context.kind === 'conversation') {
        await dispatch(
          toggleConversationMessageReaction({
            postId: context.postId,
            messageId: message.id,
            emoji,
          }),
        ).unwrap();
        return;
      }

      await dispatch(
        togglePrivateNoteThreadMessageReaction({
          postId: context.postId,
          noteId: context.noteId,
          messageId: message.id,
          emoji,
        }),
      ).unwrap();
    } catch (err) {
      addToast({
        type: 'error',
        title: err instanceof Error ? err.message : 'Failed to update reaction',
      });
    }
  }, [addToast, context, currentUserId, dispatch]);

  const handleSelectReaction = useCallback((emoji: string) => {
    if (!actionMessage && !emojiPickerMessage) {
      return;
    }
    const target = emojiPickerMessage ?? actionMessage;
    if (!target) {
      return;
    }
    void toggleReaction(target, emoji);
    setEmojiPickerMessage(null);
  }, [actionMessage, emojiPickerMessage, toggleReaction]);

  const handleDelete = useCallback(async (message: Message) => {
    if (!currentUserId || message.authorId !== currentUserId || !isPersistedMessage(message)) {
      return;
    }

    const ok = await confirm({
      title: 'Delete this message?',
      message: 'This cannot be undone.',
      destructive: true,
    });
    if (!ok) {
      return;
    }

    try {
      if (context.kind === 'conversation') {
        await dispatch(deleteConversationMessage({
          postId: context.postId,
          messageId: message.id,
        })).unwrap();
        return;
      }

      await dispatch(deletePrivateNoteThreadMessageAction({
        postId: context.postId,
        noteId: context.noteId,
        messageId: message.id,
      })).unwrap();
    } catch (err) {
      addToast({
        type: 'error',
        title: err instanceof Error ? err.message : 'Failed to delete message',
      });
    }
  }, [addToast, confirm, context, currentUserId, dispatch]);

  const actionOptions = useMemo((): MessageActionOption[] => {
    if (!actionMessage || !currentUserId) {
      return [];
    }

    const isOwnMessage = actionMessage.authorId === currentUserId;
    const canPersist = isPersistedMessage(actionMessage);
    const options: MessageActionOption[] = [];

    if (context.kind === 'conversation' && context.canReply !== false) {
      const canReply = canReplyToMessage ? canReplyToMessage(actionMessage) : true;
      if (canReply) {
        options.push({ id: 'reply', label: 'Reply', icon: 'corner-up-left' });
      }
    }

    if (canPersist) {
      options.push({ id: 'react', label: 'React with emoji', icon: 'smile' });
    }

    if (isOwnMessage && canPersist) {
      options.push({ id: 'edit', label: 'Edit', icon: 'edit-2' });
      options.push({ id: 'delete', label: 'Delete', icon: 'trash-2', destructive: true });
    }

    return options;
  }, [actionMessage, canReplyToMessage, context, currentUserId]);

  const handleSelectAction = useCallback((actionId: MessageActionId) => {
    if (!actionMessage) {
      return;
    }

    if (actionId === 'reply') {
      onReply?.(actionMessage);
      return;
    }

    if (actionId === 'react') {
      openReactionPicker(actionMessage);
      return;
    }

    if (actionId === 'edit') {
      onEdit?.(actionMessage);
      return;
    }

    if (actionId === 'delete') {
      void handleDelete(actionMessage);
    }
  }, [actionMessage, handleDelete, onEdit, onReply, openReactionPicker]);

  return {
    actionMessage,
    emojiPickerMessage,
    actionOptions,
    openActions,
    closeActions,
    openReactionPicker,
    closeReactionPicker,
    toggleReaction,
    handleSelectAction,
    handleSelectReaction,
    handleDelete,
  };
}
