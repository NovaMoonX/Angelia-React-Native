import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
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
import { VideoView, useVideoPlayer } from 'expo-video';
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
import type { Post, Reaction, Comment as CommentType } from '@/models/types';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();
  const isDemo = useAppSelector((state) => state.demo.isActive);
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
  const popoverOpacity = useRef(new Animated.Value(0)).current;
  const popoverScale = useRef(new Animated.Value(0.8)).current;

  const firstMediaItem = post?.media?.[0];
  const hasVideo = firstMediaItem?.type === 'video' && post?.media?.length === 1;
  
  // Note: Hook must be called unconditionally per React rules.
  // When hasVideo is false, we pass an empty string which creates a minimal player instance.
  const videoPlayer = useVideoPlayer(
    hasVideo ? firstMediaItem.url : '',
    (player) => {
      if (hasVideo) {
        player.loop = true;
        player.muted = false;
        // Don't auto-play - let user control via native controls
      }
    }
  );

  // Create video players for carousel items - hooks must be called unconditionally
  const carouselVideoUrls = useMemo(() => {
    if (!post?.media || post.media.length <= 1) return [];
    return post.media.map(item => item.type === 'video' ? item.url : '');
  }, [post?.media]);

  const detailPlayer0 = useVideoPlayer(carouselVideoUrls[0] || '', (p) => {
    if (carouselVideoUrls[0]) { p.loop = true; p.muted = false; }
  });
  const detailPlayer1 = useVideoPlayer(carouselVideoUrls[1] || '', (p) => {
    if (carouselVideoUrls[1]) { p.loop = true; p.muted = false; }
  });
  const detailPlayer2 = useVideoPlayer(carouselVideoUrls[2] || '', (p) => {
    if (carouselVideoUrls[2]) { p.loop = true; p.muted = false; }
  });
  const detailPlayer3 = useVideoPlayer(carouselVideoUrls[3] || '', (p) => {
    if (carouselVideoUrls[3]) { p.loop = true; p.muted = false; }
  });

  const detailCarouselPlayers = [detailPlayer0, detailPlayer1, detailPlayer2, detailPlayer3];

  // Play/pause carousel videos based on active index
  useEffect(() => {
    if (post?.media && post.media.length > 1) {
      carouselVideoUrls.forEach((url, i) => {
        if (url) {
          if (i === activeCarouselIndex) {
            detailCarouselPlayers[i]?.play();
          } else {
            detailCarouselPlayers[i]?.pause();
          }
        }
      });
    }
  }, [activeCarouselIndex, carouselVideoUrls, detailCarouselPlayers, post?.media]);

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

    // Thunk handles optimistic update + Firestore sync; in demo mode dispatch directly
    if (isDemo) {
      dispatch(
        updatePostReactions({ postId: post.id, newReaction })
      );
    } else {
      const result = await dispatch(
        updatePostReactions({ postId: post.id, newReaction })
      );
      if (updatePostReactions.rejected.match(result)) {
        addToast({ type: 'error', title: 'Failed to add reaction' });
      }
    }

    // Show comment prompt if this is the first reaction and no comments exist
    if (wasFirstReaction && post.comments.length === 0) {
      triggerCommentPrompt();
    }
  };

  const handleRemoveReaction = async (emoji: string) => {
    if (isDemo) {
      dispatch(
        removePostReaction({ postId: post.id, emoji, userId: currentUser.id })
      );
    } else {
      const result = await dispatch(
        removePostReaction({ postId: post.id, emoji, userId: currentUser.id })
      );
      if (removePostReaction.rejected.match(result)) {
        addToast({ type: 'error', title: 'Failed to remove reaction' });
      }
    }
  };


  const handleJoinConversation = async () => {
    if (!isDemo) {
      const result = await dispatch(
        joinConversation({ postId: post.id, userId: currentUser.id })
      );
      if (joinConversation.rejected.match(result)) {
        addToast({ type: 'error', title: 'Failed to join conversation' });
        return;
      }
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

    if (isDemo) {
      dispatch(
        updatePostComments({ postId: post.id, newComment: comment })
      );
    } else {
      const result = await dispatch(
        updatePostComments({ postId: post.id, newComment: comment })
      );
      if (updatePostComments.rejected.match(result)) {
        addToast({ type: 'error', title: 'Failed to send comment' });
      }
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
        <Avatar preset={author?.avatar || 'moon'} size="md" />
        <View style={styles.headerText}>
          <Text style={[styles.authorName, { color: theme.foreground }]}>
            {authorName}
          </Text>
          <Text style={[styles.timestamp, { color: theme.mutedForeground }]}>
            {getRelativeTime(post.timestamp)}
          </Text>
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
          post.media[0].type === 'video' ? (
            <View style={[styles.singleMedia, styles.videoContainer]}>
              <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color="#666" />
              <VideoView
                player={videoPlayer}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={true}
              />
            </View>
          ) : (
            <Image
              source={{ uri: post.media[0].url }}
              style={styles.singleMedia}
              contentFit="cover"
            />
          )
        ) : (
          <Carousel style={{ borderRadius: 12 }} onIndexChange={handleCarouselIndexChange}>
            {post.media.map((item, index) =>
              item.type === 'video' ? (
                <View key={`media-${index}`} style={[styles.carouselMedia, styles.videoContainer]}>
                  <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color="#666" />
                  <VideoView
                    player={detailCarouselPlayers[index]}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={true}
                  />
                </View>
              ) : (
                <Image
                  key={`media-${index}`}
                  source={{ uri: item.url }}
                  style={styles.carouselMedia}
                  contentFit="cover"
                />
              )
            )}
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

      {/* Solid background behind system nav buttons */}
      {insets.bottom > 0 && (
        <View style={{
          height: insets.bottom,
          backgroundColor: theme.background,
        }} />
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
