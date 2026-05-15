import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConversationMessage } from '@/components/conversation/ConversationMessage';
import { ConversationEmptyState } from '@/components/conversation/ConversationEmptyState';

import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectPostById, selectPostAuthor, selectPostChannel } from '@/store/slices/postsSlice';
import { selectMessages, setMessages } from '@/store/slices/conversationSlice';
import { sendMessage } from '@/store/actions/conversationActions';
import { joinConversation } from '@/store/actions/postActions';
import { subscribeToMessages } from '@/services/firebase/firestore';
import { dismissNotificationsByData } from '@/services/notifications';

import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { usePostComments } from '@/hooks/usePostComments';
import { getTierTheme } from '@/lib/conversation/tierTheme';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName, getPostExpiryInfo } from '@/lib/post/post.utils';
import { POST_TIERS, CONVERSATION_LAST_SEEN_KEY, CONVERSATION_REPLY_HINT_SEEN_KEY } from '@/models/constants';
import { KEYBOARD_BEHAVIOR } from '@/constants/layout';
import type { Message } from '@/models/types';

export default function ConversationScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<Message>>(null);
  const isDemo = useAppSelector((state) => state.demo.isActive);

  const post = useAppSelector((state) => selectPostById(state, postId ?? ''));
  const author = useAppSelector((state) => selectPostAuthor(state, post?.authorId ?? ''));
  const channel = useAppSelector((state) => selectPostChannel(state, post?.channelId ?? ''));
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const messages = useAppSelector((state) => selectMessages(state, postId ?? ''));

  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReplyHint, setShowReplyHint] = useState(false);

  // Tier theming
  const tierTheme = getTierTheme(post?.tier);
  const tierConfig = post?.tier ? POST_TIERS.find((t) => t.value === post.tier) ?? null : null;

  // Access control
  const isHost = post?.authorId === currentUser?.id;
  const hasReacted = post?.reactions.some((r) => r.userId === currentUser?.id) ?? false;
  const canAccessConversation = hasReacted || isHost;
  const isInConversation = post?.conversationEnrollees.includes(currentUser?.id ?? '') ?? false;

  // Subscribe to messages
  useEffect(() => {
    if (!postId || isDemo) return;
    const unsub = subscribeToMessages(postId, (msgs) => {
      dispatch(setMessages({ postId, messages: msgs }));
    });
    return unsub;
  }, [postId, dispatch, isDemo]);

  // Record when the user last opened this conversation to drive the unread indicator
  useFocusEffect(
    useCallback(() => {
      if (!postId || isDemo) return;
      void Promise.all([
        AsyncStorage.setItem(CONVERSATION_LAST_SEEN_KEY(postId), String(Date.now())),
        dismissNotificationsByData({ type: 'conversation_message', postId }).catch(() => {}),
        dismissNotificationsByData({ type: 'comment_reply', postId }).catch(() => {}),
      ]).catch(() => {});

      return () => {
        void AsyncStorage.setItem(CONVERSATION_LAST_SEEN_KEY(postId), String(Date.now()));
      };
    }, [postId, isDemo]),
  );

  usePostComments({ postId });

  // Load reply hint seen flag — only show the hint if user hasn't dismissed/used it before
  useEffect(() => {
    void AsyncStorage.getItem(CONVERSATION_REPLY_HINT_SEEN_KEY).then((val) => {
      if (!val) setShowReplyHint(true);
    });
  }, []);

  // Build threaded display: each root message followed immediately by its replies
  const threadedMessages = useMemo(() => {
    const roots = messages.filter((m) => { return m.parentId == null; });
    const result: Message[] = [];
    for (const root of roots) {
      result.push(root);
      const replies = messages
        .filter((m) => { return m.parentId === root.id; })
        .sort((a, b) => { return a.timestamp - b.timestamp; });
      for (const reply of replies) {
        result.push(reply);
      }
    }
    return result;
  }, [messages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadedMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [threadedMessages.length]);

  const handleSend = useCallback(async () => {
    if (!messageText.trim() || !postId) return;
    const text = messageText;
    setMessageText('');
    setReplyingTo(null);

    try {
      await dispatch(
        sendMessage({
          postId,
          text,
          parentId: replyingTo?.id ?? null,
        }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to send message' });
    }
  }, [messageText, postId, replyingTo, dispatch, addToast]);

  const handleJoinConversation = useCallback(async () => {
    if (!postId || !currentUser) return;

    try {
      await dispatch(
        joinConversation({ postId, userId: currentUser.id }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to join conversation' });
    }
  }, [postId, currentUser, dispatch, addToast]);

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
    // Dismiss the hint the first time the user actually uses reply
    if (showReplyHint) {
      setShowReplyHint(false);
      void AsyncStorage.setItem(CONVERSATION_REPLY_HINT_SEEN_KEY, 'true');
    }
  }, [showReplyHint]);

  const handleDismissReplyHint = useCallback(() => {
    setShowReplyHint(false);
    void AsyncStorage.setItem(CONVERSATION_REPLY_HINT_SEEN_KEY, 'true');
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const parentMsg = item.parentId
        ? messages.find((m) => { return m.id === item.parentId; })
        : null;
      return (
        <ConversationMessage
          message={item}
          isThreaded={item.parentId != null}
          parentText={parentMsg?.text ?? null}
          onLongPress={() => handleReply(item)}
        />
      );
    },
    [handleReply, messages],
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Derive the reply author name
  const replyAuthor = useAppSelector((state) =>
    replyingTo
      ? state.users.users.find((u) => u.id === replyingTo.authorId)
      : undefined,
  );

  if (!post || !currentUser) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.deletedPostTitle, { color: theme.foreground }]}>
          This conversation is not available
        </Text>
        <Text style={[styles.deletedPostBody, { color: theme.mutedForeground }]}>
          The post may have been deleted by the author.
        </Text>
        <Button variant="outline" onPress={() => router.replace('/(protected)/feed')}>
          Back to Feed
        </Button>
      </View>
    );
  }

  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };
  const channelBadgeLabel = channel?.isDaily ? 'Daily' : channel?.name;
  const authorName = getPostAuthorName(author, currentUser);
  const expiryInfo = channel != null
    ? getPostExpiryInfo(post.timestamp, channel.isDaily === true)
    : null;

  const headerBg = tierTheme.headerGradientColors[0] !== 'transparent'
    ? tierTheme.headerGradientColors[0]
    : theme.card;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header — lives outside KeyboardAvoidingView so it stays fixed */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: theme.border, paddingTop: isDemo ? 10 : insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={theme.foreground} />
        </Pressable>

        <Avatar
          user={author}
          size="sm"
        />

        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]} numberOfLines={1}>
            {authorName}
          </Text>
          {post.text ? (
            <Text
              style={[styles.headerSubtitle, { color: theme.mutedForeground }]}
              numberOfLines={1}
            >
              {post.text}
            </Text>
          ) : null}
          {expiryInfo != null && (
            <Text style={styles.expiryBadge}>
              {expiryInfo.daysLeft === 0 ? '⏳ Going away today' : `⏳ ${expiryInfo.daysLeft}d left`}
            </Text>
          )}
        </View>

        {channel && (
          <Badge
            style={{ backgroundColor: colors.backgroundColor, borderColor: colors.backgroundColor }}
            textStyle={{ color: colors.textColor, fontSize: 11 }}
          >
            {channelBadgeLabel}
          </Badge>
        )}

        {tierConfig && post.tier !== 'everyday' && (
          <View style={[styles.tierBadge, { backgroundColor: tierConfig.badgeBg }]}>
            <Text style={styles.tierBadgeEmoji}>{tierConfig.emoji}</Text>
            <Text style={[styles.tierBadgeText, { color: tierConfig.badgeText }]}>
              {tierConfig.label}
            </Text>
          </View>
        )}
      </View>

      {/* KeyboardAvoidingView wraps only the chat area so the header stays fixed */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={KEYBOARD_BEHAVIOR}
        keyboardVerticalOffset={0}
      >
        {/* Message list area */}
        <View style={styles.listContainer}>
          {threadedMessages.length === 0 ? (
            <ConversationEmptyState isHost={isHost} />
          ) : (
            <FlashList
              ref={listRef}
              data={threadedMessages}
              renderItem={renderMessage}
              keyExtractor={keyExtractor}
              contentContainerStyle={{ paddingBottom: 8 }}
            />
          )}
        </View>

        {/* Join CTA for users who can access but haven't joined */}
        {canAccessConversation && !isInConversation && (
          <View style={[styles.joinBar, { borderTopColor: theme.border, backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Button onPress={handleJoinConversation}>
              Join Conversation
            </Button>
          </View>
        )}

        {/* Input bar */}
        {canAccessConversation && isInConversation && (
          <View
            style={[
              styles.inputBar,
              {
                borderTopColor: theme.border,
                backgroundColor: theme.background,
                paddingBottom: Math.max(insets.bottom, 12),
                borderColor: tierTheme.inputBorderColor !== 'transparent'
                  ? tierTheme.inputBorderColor
                  : theme.border,
              },
            ]}
          >
            {/* Reply hint — shown once until used or dismissed */}
            {showReplyHint && threadedMessages.length > 0 && !replyingTo && (
              <View style={[styles.replyHint, { backgroundColor: theme.muted, borderColor: theme.border }]}>
                <Feather name="corner-up-left" size={13} color={theme.mutedForeground} />
                <Text style={[styles.replyHintText, { color: theme.mutedForeground }]}>
                  Hold any message to reply to it
                </Text>
                <Pressable onPress={handleDismissReplyHint} hitSlop={8}>
                  <Feather name="x" size={13} color={theme.mutedForeground} />
                </Pressable>
              </View>
            )}

            {replyingTo && (
              <View style={styles.replyBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.replyText, { color: theme.mutedForeground }]}>
                    Replying to {replyAuthor?.firstName ?? 'someone'}
                  </Text>
                  <Text style={[styles.replyPreview, { color: theme.mutedForeground }]} numberOfLines={1}>
                    “{replyingTo.text.length > 60 ? replyingTo.text.slice(0, 60) + '…' : replyingTo.text}”
                  </Text>
                </View>
                <Pressable onPress={() => setReplyingTo(null)}>
                  <Feather name="x" size={16} color={theme.mutedForeground} />
                </Pressable>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Say something sweet…"
                placeholderTextColor={theme.mutedForeground}
                multiline
                blurOnSubmit={false}
                style={[
                  styles.textInput,
                  {
                    color: theme.foreground,
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}
              />
              <Pressable
                onPress={handleSend}
                disabled={!messageText.trim()}
                style={({ pressed }) => [
                  styles.sendButton,
                  { backgroundColor: theme.primary, opacity: !messageText.trim() ? 0.4 : pressed ? 0.75 : 1 },
                ]}
              >
                <Feather name="send" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  deletedPostTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  deletedPostBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  expiryBadge: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
    marginTop: 2,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tierBadgeEmoji: {
    fontSize: 11,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
  },
  joinBar: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  inputBar: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  replyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  replyPreview: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 1,
  },
  replyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  replyHintText: {
    flex: 1,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
