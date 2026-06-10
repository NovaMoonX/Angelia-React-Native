import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useNavigation, type EventArg } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConversationMessage } from '@/components/conversation/ConversationMessage';
import { MessageActionSheet } from '@/components/conversation/MessageActionSheet';
import { EmojiPicker } from '@/components/EmojiPicker';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserProfileModal } from '@/components/UserProfileModal';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectPostById } from '@/store/slices/postsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { selectPrivateNoteById } from '@/store/slices/privateNotesSlice';
import { useTheme } from '@/hooks/useTheme';
import { usePrivateNoteThread } from '@/hooks/usePrivateNoteThread';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useActionModal } from '@/hooks/useActionModal';
import { useToast } from '@/hooks/useToast';
import {
  editPrivateNoteThreadMessage,
  sendPrivateNoteReply,
} from '@/store/actions/privateNoteThreadActions';
import { markUserInboxReadForPost } from '@/services/firebase/firestore';
import { dismissNotificationsByData } from '@/services/notifications';
import { isFromNotifications } from '@/lib/navigation/entryNavigation.utils';
import { KEYBOARD_BEHAVIOR } from '@/constants/layout';
import type { Message } from '@/models/types';

type ThreadRow = {
  message: Message;
  rowIndex: number;
};

export default function PrivateNoteThreadScreen() {
  const { postId, noteId, from } = useLocalSearchParams<{ postId: string; noteId: string; from?: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { confirm } = useActionModal();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<ThreadRow>>(null);
  const inputRef = useRef<TextInput>(null);
  const isRoutingAwayRef = useRef(false);

  const post = useAppSelector((state) => selectPostById(state, postId ?? ''));
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const usersMap = useAppSelector(selectAllUsersMapById);
  const note = useAppSelector((state) => selectPrivateNoteById(state, postId ?? '', noteId ?? ''));
  const { messages: threadMessages, loaded } = usePrivateNoteThread({ postId, noteId });

  const [messageText, setMessageText] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const isHost = currentUser?.id === post?.authorId;
  const isParticipant =
    !!note &&
    !!currentUser &&
    (currentUser.id === note.hostId || currentUser.id === note.authorId);

  const goBack = useCallback(() => {
    if (!postId) {
      router.replace('/(protected)/feed');
      return;
    }
    isRoutingAwayRef.current = true;
    if (isFromNotifications(from)) {
      router.dismissTo('/(protected)/notifications');
      return;
    }
    if (isHost) {
      router.dismissTo({
        pathname: '/(protected)/private-notes-host/[postId]',
        params: { postId },
      });
      return;
    }
    router.dismissTo({
      pathname: '/(protected)/private-notes-sender/[postId]',
      params: { postId },
    });
  }, [from, isHost, postId, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener(
      'beforeRemove',
      (event: EventArg<'beforeRemove', true, { action: { type: string } }>) => {
        if (isRoutingAwayRef.current) {
          return;
        }
        event.preventDefault();
        goBack();
      },
    );

    return unsubscribe;
  }, [goBack, navigation]);

  const inboxItems = useAppSelector((state) => state.userInbox.items);
  const inboxItemsRef = useRef(inboxItems);
  useEffect(() => {
    inboxItemsRef.current = inboxItems;
  }, [inboxItems]);

  useFocusEffect(
    useCallback(() => {
      if (!postId || !noteId || !currentUser) {
        return undefined;
      }

      void markUserInboxReadForPost(
        currentUser.id,
        inboxItemsRef.current,
        postId,
        ['private_note_reply'],
        noteId,
      ).catch(() => {});
      void dismissNotificationsByData({ type: 'private_note_reply', postId, noteId }).catch(() => {});

      return undefined;
    }, [currentUser?.id, noteId, postId]),
  );

  const seedMessage: Message | null = useMemo(() => {
    if (!note) {
      return null;
    }
    return {
      id: `seed-${note.id}`,
      authorId: note.authorId,
      text: note.text,
      timestamp: note.timestamp,
      parentId: null,
      reactions: {},
    };
  }, [note]);

  const rows: ThreadRow[] = useMemo(() => {
    const combined = seedMessage ? [seedMessage, ...threadMessages] : threadMessages;
    return combined.map((message, rowIndex) => ({ message, rowIndex }));
  }, [seedMessage, threadMessages]);

  const profileUser = profileUserId ? usersMap[profileUserId] ?? null : null;

  const otherParticipant = useMemo(() => {
    if (!note || !currentUser) {
      return null;
    }
    const otherUserId = currentUser.id === note.hostId ? note.authorId : note.hostId;
    return usersMap[otherUserId] ?? null;
  }, [currentUser, note, usersMap]);

  const handleStartEdit = useCallback(async (message: Message) => {
    if (!currentUser || message.authorId !== currentUser.id) {
      return;
    }

    const pendingDraft = messageText.trim();
    if (pendingDraft && (!editingMessage || editingMessage.id !== message.id)) {
      const ok = await confirm({
        title: 'Edit this message instead?',
        message: 'This will clear your current draft so you can edit the older message.',
        destructive: true,
      });
      if (!ok) {
        return;
      }
    }

    setEditingMessage(message);
    setMessageText(message.text);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [confirm, currentUser, editingMessage, messageText]);

  const messageActions = useMessageActions({
    context: { kind: 'privateNote', postId: postId ?? '', noteId: noteId ?? '' },
    currentUserId: currentUser?.id,
    onEdit: (message) => {
      void handleStartEdit(message);
    },
  });

  const handleSend = useCallback(async () => {
    const trimmed = messageText.trim();
    if (!trimmed || !postId || !noteId || isSending) {
      return;
    }

    setIsSending(true);
    try {
      if (editingMessage) {
        await dispatch(
          editPrivateNoteThreadMessage({
            postId,
            noteId,
            messageId: editingMessage.id,
            text: trimmed,
          }),
        ).unwrap();
        setEditingMessage(null);
        setMessageText('');
        addToast({ type: 'success', title: 'Message updated' });
        return;
      }

      await dispatch(sendPrivateNoteReply({ postId, noteId, text: trimmed })).unwrap();
      setMessageText('');
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: err instanceof Error ? err.message : 'Failed to send message',
      });
    } finally {
      setIsSending(false);
    }
  }, [addToast, dispatch, editingMessage, isSending, messageText, noteId, postId]);

  const handleCancelEditing = useCallback(() => {
    setEditingMessage(null);
    setMessageText('');
  }, []);

  useEffect(() => {
    if (!loaded || rows.length === 0) {
      return;
    }
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, [loaded, rows.length]);

  if (!post || !currentUser || !note || !isParticipant) {
    return <View style={[styles.centered, { backgroundColor: theme.background }]} />;
  }

  const headerTitle = otherParticipant
    ? `${otherParticipant.firstName} ${otherParticipant.lastName}`
    : 'Private note';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader title={headerTitle} onBack={goBack} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_BEHAVIOR}
        keyboardVerticalOffset={0}
      >
        <View style={styles.listContainer}>
          <FlashList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.message.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 8,
            }}
            renderItem={({ item }) => (
              <ConversationMessage
                message={item.message}
                isThreaded={false}
                currentUserId={currentUser.id}
                onSinglePress={() => {
                  Keyboard.dismiss();
                }}
                onOpenActions={() => messageActions.openActions(item.message)}
                onAvatarPress={() => setProfileUserId(item.message.authorId)}
                onToggleReaction={(emoji) => {
                  void messageActions.toggleReaction(item.message, emoji);
                }}
                onOpenReactionPicker={() => messageActions.openReactionPicker(item.message)}
              />
            )}
          />
        </View>

        <View
          style={[
            styles.inputContainer,
            {
              borderTopColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: theme.background,
            },
          ]}
        >
          {editingMessage && (
            <View style={styles.editBanner}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.editBannerLabel, { color: theme.mutedForeground }]}>
                  Editing your message
                </Text>
                <Text style={[styles.editBannerPreview, { color: theme.mutedForeground }]} numberOfLines={1}>
                  “{editingMessage.text.length > 60 ? `${editingMessage.text.slice(0, 60)}…` : editingMessage.text}”
                </Text>
              </View>
              <Pressable onPress={handleCancelEditing}>
                <Feather name="x" size={16} color={theme.mutedForeground} />
              </Pressable>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={messageText}
              onChangeText={setMessageText}
              placeholder={editingMessage ? 'Polish your message…' : 'Keep the conversation going…'}
              placeholderTextColor={theme.mutedForeground}
              multiline
              blurOnSubmit={false}
              style={[
                styles.textInput,
                {
                  color: theme.foreground,
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            />
            <Pressable
              onPress={() => {
                void handleSend();
              }}
              disabled={!messageText.trim() || isSending}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: theme.primary,
                  opacity: !messageText.trim() || isSending ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Feather name={editingMessage ? 'check' : 'send'} size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <MessageActionSheet
        visible={messageActions.actionMessage != null}
        message={messageActions.actionMessage}
        currentUserId={currentUser.id}
        options={messageActions.actionOptions}
        onClose={messageActions.closeActions}
        onSelectAction={messageActions.handleSelectAction}
        onSelectReaction={(emoji) => {
          if (messageActions.actionMessage) {
            void messageActions.toggleReaction(messageActions.actionMessage, emoji);
          }
        }}
        onOpenReactionPicker={() => {
          if (messageActions.actionMessage) {
            messageActions.openReactionPicker(messageActions.actionMessage);
          }
        }}
      />

      <EmojiPicker
        visible={messageActions.emojiPickerMessage != null}
        variant="compact"
        onSelect={(emoji) => messageActions.handleSelectReaction(emoji)}
        onClose={messageActions.closeReactionPicker}
      />

      <UserProfileModal
        visible={profileUser != null}
        user={profileUser}
        onClose={() => setProfileUserId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  inputContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  editBannerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  editBannerPreview: {
    fontSize: 12,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
