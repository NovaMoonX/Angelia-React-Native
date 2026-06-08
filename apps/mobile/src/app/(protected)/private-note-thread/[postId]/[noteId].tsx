import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectPostById } from '@/store/slices/postsSlice';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';
import { selectPrivateNoteById } from '@/store/slices/privateNotesSlice';
import { useTheme } from '@/hooks/useTheme';
import { usePrivateNoteThread } from '@/hooks/usePrivateNoteThread';
import { sendPrivateNoteReply } from '@/store/actions/privateNoteThreadActions';
import { dismissNotificationsByData } from '@/services/notifications';
import { PRIVATE_NOTE_THREAD_SEEN_KEY } from '@/models/constants';
import { KEYBOARD_BEHAVIOR } from '@/constants/layout';
import type { Message } from '@/models/types';

type ThreadRow = {
  message: Message;
  rowIndex: number;
};

export default function PrivateNoteThreadScreen() {
  const { postId, noteId } = useLocalSearchParams<{ postId: string; noteId: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<ThreadRow>>(null);
  const isRoutingAwayRef = useRef(false);

  const post = useAppSelector((state) => selectPostById(state, postId ?? ''));
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const usersMap = useAppSelector(selectAllUsersMapById);
  const note = useAppSelector((state) => selectPrivateNoteById(state, postId ?? '', noteId ?? ''));
  const { messages: threadMessages, loaded } = usePrivateNoteThread({ postId, noteId });

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

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
  }, [isHost, postId, router]);

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

  useFocusEffect(
    useCallback(() => {
      if (!postId || !noteId) {
        return undefined;
      }
      void Promise.all([
        AsyncStorage.setItem(PRIVATE_NOTE_THREAD_SEEN_KEY(postId, noteId), String(Date.now())),
        dismissNotificationsByData({ type: 'private_note_reply', postId, noteId }).catch(() => {}),
      ]).catch(() => {});

      return () => {
        void AsyncStorage.setItem(PRIVATE_NOTE_THREAD_SEEN_KEY(postId, noteId), String(Date.now()));
      };
    }, [noteId, postId]),
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

  const otherParticipant = useMemo(() => {
    if (!note || !currentUser) {
      return null;
    }
    const otherUserId = currentUser.id === note.hostId ? note.authorId : note.hostId;
    return usersMap[otherUserId] ?? null;
  }, [currentUser, note, usersMap]);

  const handleSend = useCallback(async () => {
    const trimmed = messageText.trim();
    if (!trimmed || !postId || !noteId || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await dispatch(sendPrivateNoteReply({ postId, noteId, text: trimmed })).unwrap();
      setMessageText('');
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch {
      return;
    } finally {
      setIsSending(false);
    }
  }, [dispatch, isSending, messageText, noteId, postId]);

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
                onSinglePress={() => {
                  Keyboard.dismiss();
                }}
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
          <View style={styles.inputRow}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Keep the conversation going…"
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
              <Feather name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
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
