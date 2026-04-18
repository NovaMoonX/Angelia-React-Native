import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { Carousel } from '@/components/ui/Carousel';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ChatMessage } from '@/components/ChatMessage';
import { ReactionDisplay } from '@/components/ReactionDisplay';
import { isStatusActive } from '@/components/NowStatusBadge';
import { UserProfileModal } from '@/components/UserProfileModal';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectPostById, selectPostAuthor, selectPostChannel } from '@/store/slices/postsSlice';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { getRelativeTime } from '@/lib/timeUtils';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName } from '@/lib/post/post.utils';
import { getRandomPhrase, getRandomFirstCommentPhrase } from '@/lib/post/post.constants';
import { COMMON_EMOJIS } from '@/models/constants';
import { EmojiPicker } from '@/components/EmojiPicker';
import { AddReactionIcon } from '@/components/AddReactionIcon';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import {
  updatePostReactions,
  removePostReaction,
  updatePostComments,
  joinConversation,
} from '@/store/actions/postActions';
import { generateId } from '@/utils/generateId';
import type { Reaction, Comment as CommentType, MediaItem } from '@/models/types';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();
  const post = useAppSelector((state) => selectPostById(state, id || ''));
  const author = useAppSelector((state) =>
    selectPostAuthor(state, post?.authorId || '')
  );
  const channel = useAppSelector((state) =>
    selectPostChannel(state, post?.channelId || '')
  );
  const currentUser = useAppSelector((state) => state.users.currentUser);

  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'reactions' | 'conversation'>(
    'reactions'
  );
  const [showCommentPrompt, setShowCommentPrompt] = useState(false);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const popoverOpacity = useRef(new Animated.Value(0)).current;
  const popoverScale = useRef(new Animated.Value(0.8)).current;

  const handleCarouselIndexChange = (index: number) => {
    setActiveCarouselIndex(index);
  };

  if (!post || !currentUser) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.mutedForeground }}>Post not found</Text>
      </View>
    );
  }

  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };
  const authorName = getPostAuthorName(author, currentUser);
  const hasReacted = post.reactions.some(
    (r) => r.userId === currentUser.id
  );
  const hasCommented = post.comments.some(
    (c) => c.authorId === currentUser.id
  );
  const hasInteracted = hasReacted || hasCommented;
  const isInConversation = post.conversationEnrollees.includes(
    currentUser.id
  );

  // Group reactions by emoji
  const reactionGroups = useMemo(() => {
    const groups: Record<string, { count: number; isUserReacted: boolean }> = {};
    post.reactions.forEach((r) => {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { count: 0, isUserReacted: false };
      }
      groups[r.emoji].count++;
      if (r.userId === currentUser.id) {
        groups[r.emoji].isUserReacted = true;
      }
    });
    return groups;
  }, [post.reactions, currentUser.id]);

  // Filter out emojis the user has already reacted with
  const availableCommonEmojis = useMemo(() => {
    return COMMON_EMOJIS.filter((emoji) => !reactionGroups[emoji]?.isUserReacted);
  }, [reactionGroups]);

  const triggerCommentPrompt = () => {
    // Reset animation values to initial state
    popoverOpacity.setValue(0);
    popoverScale.setValue(0.8);
    setShowCommentPrompt(true);
    Animated.parallel([
      Animated.timing(popoverOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(popoverScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(popoverOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(popoverScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setShowCommentPrompt(false));
    }, 4000);
  };

  const handleReaction = async (emoji: string) => {
    // Prevent adding the same reaction twice
    const alreadyReactedWithEmoji = post.reactions.some(
      (r) => r.userId === currentUser.id && r.emoji === emoji
    );
    if (alreadyReactedWithEmoji) return;

    const wasFirstReaction = !hasReacted;
    const newReaction: Reaction = { emoji, userId: currentUser.id };

    try {
      await dispatch(
        updatePostReactions({ postId: post.id, newReaction })
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to add reaction' });
    }

    // Show comment prompt if this is the first reaction and no comments exist
    if (wasFirstReaction && post.comments.length === 0) {
      triggerCommentPrompt();
    }
  };

  const handleRemoveReaction = async (emoji: string) => {
    try {
      await dispatch(
        removePostReaction({ postId: post.id, emoji, userId: currentUser.id })
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to remove reaction' });
    }
  };


  const handleJoinConversation = async () => {
    try {
      await dispatch(
        joinConversation({ postId: post.id, userId: currentUser.id })
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to join conversation' });
      return;
    }
    // Show comment prompt when user has already reacted but no comments exist yet
    if (hasReacted && post.comments.length === 0) {
      triggerCommentPrompt();
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;

    const comment: CommentType = {
      id: generateId('nano'),
      authorId: currentUser.id,
      text: commentText.trim(),
      timestamp: Date.now(),
    };

    setCommentText('');

    try {
      await dispatch(
        updatePostComments({ postId: post.id, newComment: comment })
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to send comment' });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.content,
          { 
            paddingTop: 0,
            paddingBottom: insets.bottom + 80
          }
        ]}
        keyboardShouldPersistTaps="handled"
      >
      {/* Post Header */}
      <View style={styles.header}>
        <Pressable
          onPress={
            author && currentUser && author.id !== currentUser.id
              ? () => setProfileModalOpen(true)
              : undefined
          }
        >
          <Avatar
            preset={author?.avatar || 'moon'}
            size="md"
            statusEmoji={isStatusActive(author?.status) ? author?.status?.emoji : undefined}
          />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.authorName, { color: theme.foreground }]}>
            {authorName}
          </Text>
          <View style={styles.headerMeta}>
            <Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
              {getRelativeTime(post.timestamp)}
            </Text>
          </View>
        </View>
        {channel && (
          <Badge
            style={{
              backgroundColor: colors.backgroundColor,
              borderColor: colors.backgroundColor,
            }}
            textStyle={{ color: colors.textColor }}
          >
            {channel.name}
          </Badge>
        )}
      </View>

      {/* Post Content */}
      {post.text ? (
        <Text style={[styles.postText, { color: theme.foreground }]}>
          {post.text}
        </Text>
      ) : null}

      {/* Media */}
      {post.media && post.media.length > 0 ? (
        post.media.length === 1 ? (
          <MediaCard
            item={post.media[0]}
            style={styles.singleMedia}
            onOpen={() => setMediaViewer({ url: post.media![0].url, type: post.media![0].type })}
          />
        ) : (
          <Carousel style={{ borderRadius: 12 }} onIndexChange={handleCarouselIndexChange}>
            {post.media.map((item, index) => (
              <MediaCard
                key={`media-${index}`}
                item={item}
                style={styles.carouselMedia}
                onOpen={() => setMediaViewer({ url: item.url, type: item.type })}
              />
            ))}
          </Carousel>
        )
      ) : null}

      {/* Tabs directly below post content */}
      <Tabs
        defaultValue="reactions"
        onValueChange={(v) =>
          setActiveTab(v as 'reactions' | 'conversation')
        }
        style={{ marginTop: 16 }}
      >
        {/* TabsList wrapper for popover positioning */}
        <View style={styles.tabsListWrapper}>
          <TabsList>
            <TabsTrigger value="reactions">
              Reactions ({post.reactions.length})
            </TabsTrigger>
            <TabsTrigger value="conversation">
              Conversation ({post.comments.length})
            </TabsTrigger>
          </TabsList>

          {/* Animated popover for prompting first comment */}
          {showCommentPrompt && (
            <Animated.View
              style={[
                styles.commentPromptPopover,
                {
                  backgroundColor: theme.primary,
                  opacity: popoverOpacity,
                  transform: [{ scale: popoverScale }],
                },
              ]}
            >
              <Text style={[styles.commentPromptText, { color: theme.primaryForeground }]}>
                Make the first comment! 💬
              </Text>
            </Animated.View>
          )}
        </View>

        <TabsContent value="reactions">
          {/* Existing reaction groups or empty state */}
          {Object.keys(reactionGroups).length > 0 ? (
            <View style={styles.reactionGroups}>
              {Object.entries(reactionGroups).map(([emoji, data]) => (
                <ReactionDisplay
                  key={emoji}
                  emoji={emoji}
                  count={data.count}
                  isUserReacted={data.isUserReacted}
                  onClick={() =>
                    data.isUserReacted
                      ? handleRemoveReaction(emoji)
                      : handleReaction(emoji)
                  }
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyReactionsContainer}>
              <Text style={[styles.emptyReactionsText, { color: theme.mutedForeground }]}>
                No reactions yet — be the first to react! 🎉
              </Text>
            </View>
          )}
        </TabsContent>

        <TabsContent value="conversation">
          {!hasReacted ? (
            <Card style={styles.joinCard}>
              <Callout
                variant="info"
                description="👋 React to this post to join the conversation and see comments!"
                style={styles.calloutNoBorder}
              />
            </Card>
          ) : !isInConversation ? (
            <Card style={styles.joinCard}>
              <Text
                style={[
                  styles.joinText,
                  { color: theme.mutedForeground },
                ]}
              >
                Join the conversation to see and post comments.
              </Text>
              <Button onPress={handleJoinConversation}>
                Join Conversation
              </Button>
            </Card>
          ) : (
            <View style={styles.conversationArea}>
              {post.comments.length === 0 ? (
                <View style={styles.emptyCommentsContainer}>
                  <Text style={[styles.emptyCommentsText, { color: theme.mutedForeground }]}>
                    {getRandomFirstCommentPhrase()}
                  </Text>
                </View>
              ) : (
                post.comments.map((comment) => (
                  <ChatMessage
                    key={comment.id}
                    authorId={comment.authorId}
                    text={comment.text}
                    timestamp={comment.timestamp}
                    isCurrentUser={
                      comment.authorId === currentUser.id
                    }
                  />
                ))
              )}

              <View style={styles.commentInput}>
                <Input
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={getRandomPhrase()}
                  style={{ flex: 1 }}
                />
                <Button
                  onPress={handleSendComment}
                  size="sm"
                  disabled={!commentText.trim()}
                >
                  Send
                </Button>
              </View>
            </View>
          )}
        </TabsContent>
      </Tabs>
      </ScrollView>

      {/* Fixed bottom emoji bar — always visible in Reactions tab */}
      {activeTab === 'reactions' && (
        <View style={[styles.fixedEmojiBar, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.fixedEmojiBarContent}
          >
            {availableCommonEmojis.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => handleReaction(emoji)}
                style={styles.emojiButton}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setEmojiPickerVisible(true)}
              style={[styles.emojiButton, { borderColor: theme.border }]}
            >
              <AddReactionIcon size={28} color={theme.mutedForeground} />
            </Pressable>
          </ScrollView>
        </View>
      )}

      <EmojiPicker
        visible={emojiPickerVisible}
        onSelect={(emoji) => {
          handleReaction(emoji);
          setEmojiPickerVisible(false);
        }}
        onClose={() => setEmojiPickerVisible(false)}
      />

      <UserProfileModal
        visible={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={author}
      />

      {/* Solid background behind system nav buttons */}
      {insets.bottom > 0 && (
        <View style={{
          height: insets.bottom,
          backgroundColor: theme.background,
        }} />
      )}

      {/* Full-screen media viewer */}
      {mediaViewer && (
        <MediaViewerModal
          uri={mediaViewer.url}
          mediaType={mediaViewer.type}
          visible
          onClose={() => setMediaViewer(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 13,
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  singleMedia: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  carouselMedia: {
    width: '100%',
    height: 250,
    overflow: 'hidden',
  },
  videoContainer: {
    backgroundColor: '#1a1a1a',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    gap: 6,
  },
  videoPlaceholderOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  watchVideoText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  fixedEmojiBar: {
    borderWidth: 1.5,
    borderRadius: 28,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fixedEmojiBarContent: {
    flexGrow: 1,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsListWrapper: {
    position: 'relative',
    overflow: 'visible',
    zIndex: 10,
  },
  reactionGroups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  joinCard: {
    alignItems: 'center',
    gap: 12,
    padding: 20,
    marginTop: 12,
  },
  joinText: {
    fontSize: 14,
    textAlign: 'center',
  },
  conversationArea: {
    marginTop: 12,
    gap: 4,
  },
  emptyCommentsContainer: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyCommentsText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  commentInput: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  commentPromptPopover: {
    position: 'absolute',
    top: -46,
    right: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 10,
  },
  commentPromptText: {
    fontSize: 14,
    fontWeight: '600',
  },
  calloutNoBorder: {
    borderWidth: 0,
  },
  emptyReactionsContainer: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyReactionsText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});

// ── MediaCard ────────────────────────────────────────────────────────────────

function MediaCard({
  item,
  style,
  onOpen,
}: {
  item: MediaItem;
  style: object;
  onOpen: () => void;
}) {
  if (item.type === 'video') {
    return (
      <Pressable style={[style, styles.videoContainer]} onPress={onOpen}>
        {item.thumbnailUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
        <View style={[styles.videoPlaceholder, item.thumbnailUrl && styles.videoPlaceholderOverlay]}>
          <Feather name="play-circle" size={48} color="#FFF" />
          {!item.thumbnailUrl && <Text style={styles.watchVideoText}>Watch Video</Text>}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onOpen}>
      <Image
        source={{ uri: item.url }}
        style={style}
        contentFit="cover"
      />
    </Pressable>
  );
}
