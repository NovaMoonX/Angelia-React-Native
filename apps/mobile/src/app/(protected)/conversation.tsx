import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useNavigation, type EventArg } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConversationMessage } from '@/components/conversation/ConversationMessage';
import { ConversationEmptyState } from '@/components/conversation/ConversationEmptyState';

import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectPostById, selectPostAuthor, selectPostChannel } from '@/store/slices/postsSlice';
import { selectMessages, setMessages } from '@/store/slices/conversationSlice';
import { store } from '@/store';
import { joinConversation } from '@/store/actions/postActions';
import { markUserInboxReadForPost, subscribeToMessages } from '@/services/firebase/firestore';
import { dismissNotificationsByData } from '@/services/notifications';
import { mergeMessagesWithPendingWrites } from '@/lib/mergePendingSnapshots';
import { isPendingWriteLocked } from '@/lib/pendingWrites';
import {
  normalizeMessageList,
  quoteText,
  resolveThreadParentKey,
} from '@/lib/conversation/threadLineage';

import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useActionModal } from '@/hooks/useActionModal';
import { usePostComments } from '@/hooks/usePostComments';
import { getTierTheme } from '@/lib/conversation/tierTheme';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName, getPostExpiryInfo } from '@/lib/post/post.utils';
import {
  POST_TIERS,
  CONVERSATION_EDIT_HINT_SEEN_KEY,
  CONVERSATION_REPLY_HINT_SEEN_KEY,
} from '@/models/constants';
import { isFromNotifications } from '@/lib/navigation/entryNavigation.utils';
import { KEYBOARD_BEHAVIOR } from '@/constants/layout';
import type { Message } from '@/models/types';
import { editMessage, sendMessage } from '@/store/actions/conversationActions';

type ThreadedConversationRow = {
  message: Message;
  depth: number;
  ancestorIds: string[];
  rowIndex: number;
  continuationDepths: number[];
};

export default function ConversationScreen() {
  const { postId, from } = useLocalSearchParams<{ postId: string; from?: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const { confirm } = useActionModal();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<ThreadedConversationRow>>(null);
  const inputRef = useRef<TextInput>(null);
  const isDemo = useAppSelector((state) => state.demo.isActive);

  const post = useAppSelector((state) => selectPostById(state, postId ?? ''));
  const author = useAppSelector((state) => selectPostAuthor(state, post?.authorId ?? ''));
  const channel = useAppSelector((state) => selectPostChannel(state, post?.channelId ?? ''));
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const messages = useAppSelector((state) => selectMessages(state, postId ?? ''));

  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showReplyHint, setShowReplyHint] = useState(false);
  const [showEditHint, setShowEditHint] = useState(false);
  const [replyDepthWarning, setReplyDepthWarning] = useState<string | null>(null);
  const isRoutingToPostRef = useRef(false);
  const normalizedMessages = useMemo(() => normalizeMessageList(messages), [messages]);

  const goToPostDetails = useCallback(() => {
    if (!postId) {
      router.replace('/(protected)/feed');
      return;
    }
    isRoutingToPostRef.current = true;
    if (isFromNotifications(from)) {
      router.dismissTo('/(protected)/notifications');
      return;
    }
    router.dismissTo({ pathname: '/(protected)/post/[id]', params: { id: postId } });
  }, [from, postId, router]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: EventArg<'beforeRemove', true, { action: { type: string } }>) => {
      if (isRoutingToPostRef.current) {
        return;
      }
      event.preventDefault();
      goToPostDetails();
    });

    return unsubscribe;
  }, [goToPostDetails, navigation]);

  // Tier theming
  const tierTheme = getTierTheme(post?.tier);
  const tierConfig = post?.tier ? POST_TIERS.find((t) => t.value === post.tier) ?? null : null;

  // Access control
  const isHost = post?.authorId === currentUser?.id;
  const hasReacted = post?.reactions.some((r) => r.userId === currentUser?.id) ?? false;
  const canAccessConversation = hasReacted || isHost;
  const isInConversation = post?.conversationEnrollees.includes(currentUser?.id ?? '') ?? false;

  const inboxItems = useAppSelector((state) => state.userInbox.items);
  const inboxItemsRef = useRef(inboxItems);
  useEffect(() => {
    inboxItemsRef.current = inboxItems;
  }, [inboxItems]);

  useEffect(() => {
    if (!postId || isDemo) return;
    let unsub: (() => void) | null = null;
    unsub = subscribeToMessages(postId, (msgs) => {
      const state = store.getState();
      const local = state.conversation.messagesByPost[postId] ?? [];
      dispatch(
        setMessages({
          postId,
          messages: mergeMessagesWithPendingWrites(normalizeMessageList(msgs), local),
        }),
      );
    });
    return () => {
      const doUnsub = () => {
        unsub?.();
      };
      if (isPendingWriteLocked(postId, 'message')) {
        setTimeout(doUnsub, 800);
      } else {
        doUnsub();
      }
    };
  }, [postId, dispatch, isDemo]);

  useFocusEffect(
    useCallback(() => {
      if (!postId || isDemo || !currentUser) {
        return undefined;
      }

      void markUserInboxReadForPost(
        currentUser.id,
        inboxItemsRef.current,
        postId,
        ['conversation_message', 'comment_reply'],
      ).catch(() => {});
      void dismissNotificationsByData({ type: 'conversation_message', postId }).catch(() => {});
      void dismissNotificationsByData({ type: 'comment_reply', postId }).catch(() => {});

      return undefined;
    }, [currentUser?.id, postId, isDemo]),
  );

  usePostComments({ postId });

  // Load reply hint seen flag — only show the hint if user hasn't dismissed/used it before
  useEffect(() => {
    void AsyncStorage.getItem(CONVERSATION_REPLY_HINT_SEEN_KEY).then((val) => {
      if (!val) setShowReplyHint(true);
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(CONVERSATION_EDIT_HINT_SEEN_KEY).then((val) => {
      if (!val) setShowEditHint(true);
    });
  }, []);

  const messageDepthById = useMemo(() => {
    const byId = new Map<string, Message>();
    normalizedMessages.forEach((message) => {
      byId.set(message.id, message);
    });

    const depthCache = new Map<string, number>();

    const resolveDepth = (message: Message): number => {
      if (depthCache.has(message.id)) {
        return depthCache.get(message.id) ?? 0;
      }
      if (message.parentId == null) {
        depthCache.set(message.id, 0);
        return 0;
      }

      const parent = byId.get(message.parentId);
      if (!parent) {
        depthCache.set(message.id, 0);
        return 0;
      }

      const depth = resolveDepth(parent) + 1;
      depthCache.set(message.id, depth);
      return depth;
    };

    const result: Record<string, number> = {};
    normalizedMessages.forEach((message) => {
      result[message.id] = resolveDepth(message);
    });
    return result;
  }, [normalizedMessages]);

  const messageIdsWithReplies = useMemo(() => {
    const ids = new Set<string>();
    normalizedMessages.forEach((message) => {
      if (message.parentId != null) {
        ids.add(message.parentId);
      }
    });
    return ids;
  }, [normalizedMessages]);

  // Build threaded display to 2 levels: root -> reply -> reply-to-reply.
  const threadedMessages = useMemo(() => {
    const childrenByParent = new Map<string | null, Message[]>();

    normalizedMessages.forEach((message) => {
      const key = message.parentId ?? null;
      const siblings = childrenByParent.get(key) ?? [];
      siblings.push(message);
      childrenByParent.set(key, siblings);
    });

    childrenByParent.forEach((siblings) => {
      siblings.sort((a, b) => {
        if (a.timestamp === b.timestamp) {
          return a.id.localeCompare(b.id);
        }
        return a.timestamp - b.timestamp;
      });
    });

    const rows: Array<Pick<ThreadedConversationRow, 'message' | 'depth' | 'ancestorIds' | 'rowIndex'>> = [];
    const subtreeEndIndexByMessageId = new Map<string, number>();

    const walk = (parentId: string | null, depth: number, ancestorIds: string[]): number => {
      let lastIndex = -1;
      const children = childrenByParent.get(parentId) ?? [];

      children.forEach((child) => {
        const rowIndex = rows.length;
        rows.push({
          message: child,
          depth,
          ancestorIds: [...ancestorIds],
          rowIndex,
        });

        const subtreeEnd = walk(child.id, depth + 1, [...ancestorIds, child.id]);
        const endIndex = Math.max(rowIndex, subtreeEnd);
        subtreeEndIndexByMessageId.set(child.id, endIndex);
        lastIndex = endIndex;
      });

      return lastIndex;
    };

    walk(null, 0, []);

    return rows.map((row) => {
      const continuationDepths = row.ancestorIds.flatMap((ancestorId, ancestorDepth) => {
        const subtreeEndIndex = subtreeEndIndexByMessageId.get(ancestorId);
        return subtreeEndIndex != null && row.rowIndex < subtreeEndIndex ? [ancestorDepth] : [];
      });

      return {
        ...row,
        continuationDepths,
      };
    });
  }, [normalizedMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (threadedMessages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [threadedMessages.length]);

  const handleSend = useCallback(async () => {
    if (!messageText.trim() || !postId) return;
    const text = messageText.trim();
    const editingTarget = editingMessage;
    setMessageText('');
    setReplyingTo(null);
    setEditingMessage(null);
    setReplyDepthWarning(null);

    try {
      if (editingTarget) {
        await dispatch(
          editMessage({
            postId,
            messageId: editingTarget.id,
            text,
          }),
        ).unwrap();
        addToast({ type: 'success', title: 'Message updated' });
        return;
      }

      await dispatch(
        sendMessage({
          postId,
          text,
          parentId: replyingTo?.id ?? null,
        }),
      ).unwrap();
    } catch (err) {
      setMessageText(text);
      setEditingMessage(editingTarget);
      if (!editingTarget) {
        setReplyingTo(replyingTo);
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      addToast({
        type: 'error',
        title: editingTarget
          ? `Failed to update: ${errorMessage}`
          : `Failed to send: ${errorMessage}`,
      });
    }
  }, [messageText, postId, editingMessage, dispatch, addToast, replyingTo]);

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
    const messageDepth = messageDepthById[message.id] ?? 0;
    if (messageDepth >= 2) {
      setReplyingTo(null)
      setReplyDepthWarning("You can't reply to message this deep in the thread.");
      return;
    }

    void Haptics.selectionAsync().catch(() => {});
    setReplyDepthWarning(null);
    setReplyingTo(message);
    setEditingMessage(null);
    // Dismiss the hint the first time the user actually uses reply
    if (showReplyHint) {
      setShowReplyHint(false);
      void AsyncStorage.setItem(CONVERSATION_REPLY_HINT_SEEN_KEY, 'true');
    }
  }, [messageDepthById, showReplyHint]);

  const handleDismissReplyHint = useCallback(() => {
    setShowReplyHint(false);
    void AsyncStorage.setItem(CONVERSATION_REPLY_HINT_SEEN_KEY, 'true');
  }, []);

  const handleDismissEditHint = useCallback(() => {
    setShowEditHint(false);
    void AsyncStorage.setItem(CONVERSATION_EDIT_HINT_SEEN_KEY, 'true');
  }, []);

  const handleCancelEditing = useCallback(() => {
    setEditingMessage(null);
    setMessageText('');
  }, []);

  const handleStartEdit = useCallback(async (message: Message) => {
    if (!currentUser) {
      return;
    }
    if (message.isSystem || message.authorId !== currentUser.id) {
      return;
    }

    const pendingDraft = messageText.trim();
    if (pendingDraft && (!editingMessage || editingMessage.id !== message.id)) {
      const ok = await confirm({
        title: 'Edit this message instead?',
        message: 'This will clear your current draft so you can edit the older message.',
        destructive: true,
      });
      if (!ok) return;
    }

    setReplyingTo(null);
    setReplyDepthWarning(null);
    setEditingMessage(message);
    setMessageText(message.text);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    if (showEditHint) {
      setShowEditHint(false);
      void AsyncStorage.setItem(CONVERSATION_EDIT_HINT_SEEN_KEY, 'true');
    }

    void Haptics.selectionAsync().catch(() => {});
  }, [confirm, currentUser, editingMessage, messageText, showEditHint]);

  const renderMessage = useCallback(
    ({ item }: { item: ThreadedConversationRow }) => {
      const parentMsg = item.message.parentId
        ? normalizedMessages.find((m) => {
            return m.id === (item.depth >= 2 ? resolveThreadParentKey(item.message) : item.message.parentId);
          })
        : null;
      const depth = messageDepthById[item.message.id] ?? 0;
      const canEditMessage =
        item.message.authorId === currentUser?.id && item.message.isSystem !== true;
      return (
        <ConversationMessage
          message={item.message}
          isThreaded={depth > 0}
          hasReplies={messageIdsWithReplies.has(item.message.id)}
          continuationDepths={item.continuationDepths}
          depth={depth}
          parentText={parentMsg?.text ? quoteText(parentMsg.text, depth >= 2 ? 48 : 60) : null}
          onSinglePress={() => {
            Keyboard.dismiss();
          }}
          onLongPress={() => handleReply(item.message)}
          onDoublePress={canEditMessage ? () => { void handleStartEdit(item.message); } : undefined}
        />
      );
    },
    [currentUser?.id, handleReply, handleStartEdit, messageDepthById, messageIdsWithReplies, normalizedMessages],
  );

  const keyExtractor = useCallback((item: ThreadedConversationRow) => item.message.id, []);

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
        <Pressable onPress={goToPostDetails} style={styles.backButton}>
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
      </View>

      {tierConfig && post.tier !== 'everyday' && (
        <View style={[styles.priorityBanner, { backgroundColor: tierConfig.badgeBg }]}> 
          <Text style={styles.priorityBannerEmoji}>{tierConfig.emoji}</Text>
          <Text style={[styles.priorityBannerText, { color: tierConfig.badgeText }]}> 
            {tierConfig.label}
          </Text>
        </View>
      )}

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
              keyboardShouldPersistTaps='handled'
              keyboardDismissMode='none'
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
            {showReplyHint && threadedMessages.length > 0 && !replyingTo && !editingMessage && (
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

            {showEditHint && threadedMessages.some((row) => {
              return row.message.authorId === currentUser.id && row.message.isSystem !== true;
            }) && !replyingTo && !editingMessage && (
              <View style={[styles.replyHint, { backgroundColor: theme.muted, borderColor: theme.border }]}> 
                <Feather name="edit-2" size={13} color={theme.mutedForeground} />
                <Text style={[styles.replyHintText, { color: theme.mutedForeground }]}> 
                  Double tap your own message to edit it
                </Text>
                <Pressable onPress={handleDismissEditHint} hitSlop={8}>
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

            {editingMessage && (
              <View style={styles.replyBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.replyText, { color: theme.mutedForeground }]}> 
                    Editing your message
                  </Text>
                  <Text style={[styles.replyPreview, { color: theme.mutedForeground }]} numberOfLines={1}>
                    “{editingMessage.text.length > 60 ? editingMessage.text.slice(0, 60) + '…' : editingMessage.text}”
                  </Text>
                </View>
                <Pressable onPress={handleCancelEditing}>
                  <Feather name="x" size={16} color={theme.mutedForeground} />
                </Pressable>
              </View>
            )}

            {replyDepthWarning && (
              <View style={[styles.replyDepthWarning, { backgroundColor: theme.muted, borderColor: theme.border }]}> 
                <Feather name="alert-circle" size={13} color={theme.mutedForeground} />
                <Text style={[styles.replyDepthWarningText, { color: theme.mutedForeground }]}>
                  {replyDepthWarning}
                </Text>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={messageText}
                onChangeText={setMessageText}
                placeholder={editingMessage ? 'Polish your message…' : 'Say something sweet…'}
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
                <Feather name={editingMessage ? 'check' : 'send'} size={18} color="#FFFFFF" />
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
  priorityBanner: {
    marginTop: 0,
    marginHorizontal: -12,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  priorityBannerEmoji: {
    fontSize: 13,
  },
  priorityBannerText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
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
  replyDepthWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  replyDepthWarningText: {
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
