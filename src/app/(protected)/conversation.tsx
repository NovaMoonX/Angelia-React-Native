import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConversationMessage } from '@/components/conversation/ConversationMessage';
import { ConversationEmptyState } from '@/components/conversation/ConversationEmptyState';

import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectPostById, selectPostAuthor, selectPostChannel } from '@/store/slices/postsSlice';
import { selectMessages, setMessages } from '@/store/slices/conversationSlice';
import { sendMessage, sendJoinMessage } from '@/store/actions/conversationActions';
import { joinConversation } from '@/store/actions/postActions';
import { subscribeToMessages } from '@/services/firebase/firestore';

import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { usePostComments } from '@/hooks/usePostComments';
import { getTierTheme } from '@/lib/conversation/tierTheme';
import { getPostAuthorName } from '@/lib/post/post.utils';
import { getColorPair } from '@/lib/channel/channel.utils';
import { isStatusActive } from '@/components/NowStatusBadge';
import { POST_TIERS } from '@/models/constants';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
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
  const [hasPlayedEntry, setHasPlayedEntry] = useState(false);

  // Tier theming
  const tierTheme = getTierTheme(post?.tier);
  const tierConfig = post?.tier ? POST_TIERS.find((t) => t.value === post.tier) ?? null : null;

  // Entry animation for Big News and Worth Knowing
  const entryScale = useSharedValue(1);
  const confettiOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  const entryAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: entryScale.value }],
  }));

  const confettiAnimatedStyle = useAnimatedStyle(() => ({
    opacity: confettiOpacity.value,
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // Access control
  const hasReacted = post?.reactions.some((r) => r.userId === currentUser?.id) ?? false;
  const isInConversation = post?.conversationEnrollees.includes(currentUser?.id ?? '') ?? false;

  // Subscribe to messages
  useEffect(() => {
    if (!postId || isDemo) return;
    const unsub = subscribeToMessages(postId, (msgs) => {
      dispatch(setMessages({ postId, messages: msgs }));
    });
    return unsub;
  }, [postId, dispatch, isDemo]);

  // Subscribe to comments — handled by hook
  usePostComments(postId ?? '');

  // Entry animation for Big News and Worth Knowing tiers
  useEffect(() => {
    if (!hasReacted || !isInConversation || hasPlayedEntry) return;

    if (post?.tier === 'big-news') {
      setHasPlayedEntry(true);
      entryScale.value = withSequence(
        withTiming(1.08, { duration: 300 }),
        withSpring(1, { damping: 8, stiffness: 150 }),
      );
      confettiOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 800 }),
      );
    } else if (post?.tier === 'worth-knowing') {
      setHasPlayedEntry(true);
      entryScale.value = withSequence(
        withTiming(1.04, { duration: 250 }),
        withSpring(1, { damping: 10, stiffness: 120 }),
      );
      glowOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 600 }),
      );
    }
  }, [post?.tier, hasReacted, isInConversation, hasPlayedEntry, entryScale, confettiOpacity, glowOpacity]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

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

      // Read the latest post for fresh reactions
      const userReactions = (post?.reactions ?? []).filter(
        (r) => r.userId === currentUser.id,
      );
      const emoji = userReactions.length > 0
        ? userReactions[userReactions.length - 1].emoji
        : '✨';

      await dispatch(
        sendJoinMessage({ postId, emoji: emoji || '✨' }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to join conversation' });
    }
  }, [postId, currentUser, dispatch, addToast, post]);

  const handleReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <ConversationMessage
        message={item}
        isThreaded={item.parentId != null}
        onLongPress={() => handleReply(item)}
      />
    ),
    [handleReply],
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
        <Text style={{ color: theme.mutedForeground }}>
          Conversation not found
        </Text>
      </View>
    );
  }

  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };
  const authorName = getPostAuthorName(author, currentUser);

  const headerBg = tierTheme.headerGradientColors[0] !== 'transparent'
    ? tierTheme.headerGradientColors[0]
    : theme.card;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      {/* Header */}
      <Animated.View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: theme.border, paddingTop: isDemo ? 10 : insets.top + 10 }, entryAnimatedStyle]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={theme.foreground} />
        </Pressable>

        <Avatar
          preset={author?.avatar ?? 'moon'}
          uri={author?.avatarUrl}
          size="sm"
          statusEmoji={isStatusActive(author?.status) ? author?.status?.emoji : undefined}
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
        </View>

        {channel && (
          <Badge
            style={{ backgroundColor: colors.backgroundColor, borderColor: colors.backgroundColor }}
            textStyle={{ color: colors.textColor, fontSize: 11 }}
          >
            {channel.name}
          </Badge>
        )}

        {tierConfig && post.tier !== 'everyday' && (
          <View style={[styles.tierIndicator, { backgroundColor: tierConfig.badgeBg }]}>
            <Text style={styles.tierEmoji}>{tierConfig.emoji}</Text>
          </View>
        )}
      </Animated.View>

      {/* Confetti overlay for Big News entry */}
      {tierTheme.celebratory && (
        <Animated.View
          style={[styles.confettiOverlay, confettiAnimatedStyle]}
          pointerEvents="none"
        >
          <Text style={styles.confettiText}>🎉 ✨ 🥳 ✨ 🎉</Text>
        </Animated.View>
      )}

      {/* Amber glow overlay for Worth Knowing entry */}
      {post.tier === 'worth-knowing' && (
        <Animated.View
          style={[styles.glowOverlay, glowAnimatedStyle]}
          pointerEvents="none"
        >
          <Text style={styles.glowText}>✨ 🌟 ✨</Text>
        </Animated.View>
      )}

      {/* Message list area */}
      <View style={styles.listContainer}>
        {messages.length === 0 ? (
          <ConversationEmptyState />
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            contentContainerStyle={{ paddingBottom: 8 }}
          />
        )}
      </View>

      {/* Join CTA for users who reacted but haven't joined */}
      {hasReacted && !isInConversation && (
        <View style={[styles.joinBar, { borderTopColor: theme.border, backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Button onPress={handleJoinConversation}>
            Join Conversation
          </Button>
        </View>
      )}

      {/* Input bar */}
      {hasReacted && isInConversation && (
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
          {replyingTo && (
            <View style={styles.replyBanner}>
              <Text style={[styles.replyText, { color: theme.mutedForeground }]}>
                Replying to {replyAuthor?.firstName ?? 'someone'}…
              </Text>
              <Pressable onPress={() => setReplyingTo(null)}>
                <Feather name="x" size={16} color={theme.mutedForeground} />
              </Pressable>
            </View>
          )}

          <View style={styles.inputRow}>
            <Input
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Say something sweet…"
              style={styles.textInput}
              onSubmitEditing={handleSend}
            />
            <Button
              onPress={handleSend}
              size="sm"
              disabled={!messageText.trim()}
            >
              Send
            </Button>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  tierIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierEmoji: {
    fontSize: 14,
  },
  confettiOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  },
  confettiText: {
    fontSize: 32,
    letterSpacing: 6,
  },
  glowOverlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  },
  glowText: {
    fontSize: 28,
    letterSpacing: 8,
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
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
  },
});
