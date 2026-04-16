import React, { useState, useMemo } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { Separator } from '@/components/ui/Separator';
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
import { isValidEmoji, getRandomPhrase } from '@/lib/post/post.constants';
import { COMMON_EMOJIS } from '@/models/constants';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import {
  updateReactionsOptimistic,
  removeReactionOptimistic,
  updateCommentsOptimistic,
} from '@/store/slices/postsSlice';
import {
  updatePostReactions,
  updatePostComments,
  joinConversation as firestoreJoinConversation,
} from '@/services/firebase/firestore';
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

  const [customEmoji, setCustomEmoji] = useState('');
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState<'reactions' | 'conversation'>(
    'reactions'
  );

  const firstMediaItem = post?.media?.[0];
  const videoPlayer = useVideoPlayer(
    firstMediaItem?.type === 'video' && post?.media?.length === 1
      ? firstMediaItem.url
      : '',
    (player) => {
      player.loop = true;
    }
  );

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

  const handleReaction = async (emoji: string) => {
    const newReaction: Reaction = { emoji, userId: currentUser.id };
    const updatedReactions = [...post.reactions, newReaction];
    dispatch(
      updateReactionsOptimistic({ postId: post.id, reactions: updatedReactions })
    );
    if (!isDemo) {
      try {
        await updatePostReactions(post.id, updatedReactions);
      } catch {
        addToast({ type: 'error', title: 'Failed to add reaction' });
      }
    }
  };

  const handleRemoveReaction = async (emoji: string) => {
    dispatch(
      removeReactionOptimistic({
        postId: post.id,
        emoji,
        userId: currentUser.id,
      })
    );
    if (!isDemo) {
      try {
        const updated = post.reactions.filter(
          (r) => !(r.emoji === emoji && r.userId === currentUser.id)
        );
        await updatePostReactions(post.id, updated);
      } catch {
        addToast({
          type: 'error',
          title: 'Failed to remove reaction',
        });
      }
    }
  };

  const handleCustomEmoji = () => {
    const trimmed = customEmoji.trim();
    if (trimmed && isValidEmoji(trimmed)) {
      handleReaction(trimmed);
      setCustomEmoji('');
    }
  };

  const handleJoinConversation = async () => {
    if (!isDemo) {
      try {
        await firestoreJoinConversation(post.id, currentUser.id);
      } catch {
        addToast({ type: 'error', title: 'Failed to join conversation' });
      }
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

    const updatedComments = [...post.comments, comment];
    dispatch(
      updateCommentsOptimistic({ postId: post.id, comments: updatedComments })
    );
    setCommentText('');

    if (!isDemo) {
      try {
        await updatePostComments(post.id, updatedComments);
      } catch {
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
          { paddingTop: isDemo ? 12 : insets.top + 8 }
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
            <VideoView
              player={videoPlayer}
              style={styles.singleMedia}
              contentFit="cover"
              nativeControls={true}
            />
          ) : (
            <Image
              source={{ uri: post.media[0].url }}
              style={styles.singleMedia}
              contentFit="cover"
            />
          )
        ) : (
          <Carousel>
            {post.media.map((item, index) =>
              item.type === 'video' ? (
                <View key={`media-${index}`} style={styles.carouselMedia}>
                  <Text style={[styles.videoLabel, { color: theme.mutedForeground }]}>
                    📹 Video (tap post to view)
                  </Text>
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

      <Separator style={{ marginVertical: 16 }} />

      {/* First interaction encouragement */}
      {!hasInteracted && (
        <Callout
          variant="info"
          description="👋 React to this post to join the conversation and see comments!"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Reaction Buttons */}
      <View style={styles.reactionSection}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
          React
        </Text>
        <View style={styles.emojiRow}>
          {COMMON_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleReaction(emoji)}
              style={styles.emojiButton}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
          <TextInput
            value={customEmoji}
            onChangeText={setCustomEmoji}
            placeholder="🎯"
            maxLength={2}
            onSubmitEditing={handleCustomEmoji}
            style={[styles.customEmojiInput, { borderColor: theme.border, color: theme.foreground }]}
          />
        </View>
      </View>

      {/* Tabs: Reactions + Conversation (shown after reacting) */}
      {(hasReacted ||
        post.reactions.length > 0 ||
        post.comments.length > 0) && (
        <>
          <Separator style={{ marginVertical: 16 }} />
          <Tabs
            defaultValue="reactions"
            onValueChange={(v) =>
              setActiveTab(v as 'reactions' | 'conversation')
            }
          >
            <TabsList>
              <TabsTrigger value="reactions">
                Reactions ({post.reactions.length})
              </TabsTrigger>
              <TabsTrigger value="conversation">
                Conversation ({post.comments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reactions">
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
            </TabsContent>

            <TabsContent value="conversation">
              {!isInConversation ? (
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
                  {post.comments.map((comment) => (
                    <ChatMessage
                      key={comment.id}
                      authorId={comment.authorId}
                      text={comment.text}
                      timestamp={comment.timestamp}
                      isCurrentUser={
                        comment.authorId === currentUser.id
                      }
                    />
                  ))}

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
        </>
      )}
      </ScrollView>
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
    marginBottom: 16,
  },
  carouselMedia: {
    width: '100%',
    height: 250,
    borderRadius: 12,
  },
  reactionSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  emojiButton: {
    padding: 6,
  },
  emojiText: {
    fontSize: 22,
  },
  customEmojiInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    paddingHorizontal: 4,
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
  commentInput: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  videoLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 100,
  },
});
