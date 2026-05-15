import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Carousel } from '@/components/ui/Carousel';
import { UserProfileModal } from '@/components/UserProfileModal';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { AudioAttachmentPlayer } from '@/components/AudioAttachmentPlayer';
import { useAppSelector } from '@/store/hooks';
import {
  selectPostAuthor,
  selectPostChannel,
} from '@/store/slices/postsSlice';
import { useRelativeTime } from '@/hooks/useRelativeTime';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName, getPostExpiryInfo } from '@/lib/post/post.utils';
import { compareReactionGroupPriority } from '@/lib/reaction/reaction.utils';
import { POST_TIERS } from '@/models/constants';
import type { Post, MediaItem } from '@/models/types';
import { useTheme } from '@/hooks/useTheme';

interface PostCardProps {
  post: Post;
  onNavigate?: () => void;
  onLongPress?: () => void;
  reactionPill?: React.ReactNode;
}

export function PostCard({ post, onNavigate, onLongPress, reactionPill: reactionPeel }: PostCardProps) {
  const author = useAppSelector((state) =>
    selectPostAuthor(state, post.authorId)
  );
  const channel = useAppSelector((state) =>
    selectPostChannel(state, post.channelId)
  );
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const { theme } = useTheme();

  const channelBadgeLabel = channel?.isDaily ? 'Daily' : channel?.name;

  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };
  const authorName = getPostAuthorName(author, currentUser);
  const relativeTime = useRelativeTime(post.timestamp);
  const hasMultipleMedia = post.media && post.media.length > 1;
  const isOtherUser = author && currentUser && author.id !== currentUser.id;
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video' | 'audio'; caption: string | null } | null>(null);
  const cardScale = useRef(new Animated.Value(1)).current;

  const handleCardLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(cardScale, {
        toValue: 0.97,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        tension: 150,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    onLongPress?.();
  }, [cardScale, onLongPress]);
  const cardLongPressHandler = onLongPress ? handleCardLongPress : undefined;
  const cardScaleStyle = useMemo(() => {
    return { transform: [{ scale: cardScale }] };
  }, [cardScale]);

  const hasTierBadge = post.tier === 'worth-knowing' || post.tier === 'big-news';

  const tierBadgeConfig = post.tier ? POST_TIERS.find((t) => t.value === post.tier) ?? null : null;

  const expiryInfo = channel != null
    ? getPostExpiryInfo(post.timestamp, channel.isDaily === true)
    : null;

  const topReactions = useMemo(() => {
    const groups: Record<string, { count: number; oldestTimestamp: number }> = {};
    post.reactions.forEach((r) => {
      const timestamp = typeof r.timestamp === 'number' ? r.timestamp : 0;
      if (!groups[r.emoji]) {
        groups[r.emoji] = { count: 0, oldestTimestamp: timestamp };
      }
      groups[r.emoji].count += 1;
      if (timestamp < groups[r.emoji].oldestTimestamp) {
        groups[r.emoji].oldestTimestamp = timestamp;
      }
    });
    return Object.entries(groups)
      .map(([emoji, data]) => {
        return { emoji, count: data.count, oldestTimestamp: data.oldestTimestamp };
      })
      .sort((a, b) => {
        return compareReactionGroupPriority(a, b);
      })
      .slice(0, 5)
      .map((group) => {
        return group.emoji;
      });
  }, [post.reactions]);

  // Show footer when there are reactions, or when this is another user's post (to prompt engagement).
  // No footer when viewing own posts with no reactions (avoids dead space at the bottom of the card).
  const hasFooter = topReactions.length > 0 || !!isOtherUser;

  return (
    <View style={[styles.cardWrapper, hasTierBadge && styles.cardWrapperBadged]}>
      {hasTierBadge && tierBadgeConfig && (
        <View style={[styles.cornerBadge, { backgroundColor: tierBadgeConfig.badgeBg }]}>
          <Text style={styles.cornerBadgeEmoji}>{tierBadgeConfig.emoji}</Text>
          <Text style={[styles.cornerBadgeText, { color: tierBadgeConfig.badgeText }]}>
            {tierBadgeConfig.label}
          </Text>
        </View>
      )}
      <Animated.View style={cardScaleStyle}>
      <Card style={styles.card}>
        {/* Tappable header + text area */}
        <Pressable onPress={onNavigate} onLongPress={cardLongPressHandler} delayLongPress={220}>
          <View style={styles.header}>
            <Pressable
              onPress={isOtherUser ? () => setProfileModalOpen(true) : undefined}
            >
              <Avatar
                user={author}
                size="sm"
              />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={[styles.authorName, { color: theme.foreground }]}>
                {authorName}
              </Text>
              <View style={styles.headerMeta}>
                <Text style={[styles.time, { color: theme.mutedForeground }]}>
                  {relativeTime}
                </Text>
                {expiryInfo != null && (
                  <Text style={styles.expiryBadge}>
                    {expiryInfo.daysLeft === 0 ? '⏳ Going away today' : `⏳ ${expiryInfo.daysLeft}d left`}
                  </Text>
                )}
              </View>
            </View>
            {channel && (
              <Badge
                style={{
                  backgroundColor: colors.backgroundColor,
                  borderColor: colors.backgroundColor,
                }}
                textStyle={{ color: colors.textColor, fontSize: 11 }}
              >
                {channelBadgeLabel}
              </Badge>
            )}
          </View>

        {post.text ? (
          <Text
            style={[styles.postText, { color: theme.foreground }]}
            numberOfLines={4}
          >
            {post.text}
          </Text>
        ) : null}
      </Pressable>

      {/* Media section — carousel is NOT wrapped in Pressable so swipe/buttons work */}
      {post.media && post.media.length > 0 ? (
        hasMultipleMedia ? (
          <Carousel>
            {post.media.map((item, index) => (
              <CardMediaItem
                key={`media-${index}`}
                item={item}
                style={styles.carouselImage}
                onOpen={() => setMediaViewer({ url: item.url, type: item.type, caption: item.caption ?? null })}
                onLongPress={cardLongPressHandler}
              />
            ))}
          </Carousel>
        ) : (
          <CardMediaItem
            item={post.media[0]}
            style={styles.singleImage}
            onOpen={() => setMediaViewer({ url: post.media![0].url, type: post.media![0].type, caption: post.media![0].caption ?? null })}
            onLongPress={cardLongPressHandler}
          />
        )
      ) : null}

      {/* Tappable footer */}
      {hasFooter && (
        <Pressable onPress={onNavigate} onLongPress={cardLongPressHandler} delayLongPress={220}>
          <View style={styles.footer}>
            {topReactions.length > 0 ? (
              <View style={styles.reactionStack}>
                {topReactions.map((emoji, i) => (
                  <View
                    key={emoji}
                    style={[
                      styles.reactionBubble,
                      {
                        marginLeft: i === 0 ? 0 : -8,
                        zIndex: topReactions.length - i,
                        backgroundColor: theme.card,
                        borderColor: theme.background,
                      },
                    ]}
                  >
                    <Text style={styles.reactionBubbleEmoji}>{emoji}</Text>
                  </View>
                ))}
              </View>
            ) : isOtherUser ? (
              <Text style={[styles.firstReactText, { color: theme.mutedForeground }]}>
                Be the first to react! 🎉
              </Text>

            ) : null}
          </View>
        </Pressable>
      )}

      {/* User profile modal for other users */}
      <UserProfileModal
        visible={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={author}
      />

      {/* Full-screen media viewer */}
      {mediaViewer && (
        <MediaViewerModal
          uri={mediaViewer.url}
          mediaType={mediaViewer.type}
          caption={mediaViewer.caption}
          visible
          onClose={() => setMediaViewer(null)}
        />
      )}
    </Card>
    </Animated.View>
    {reactionPeel}
    </View>
  );
}

// ── CardMediaItem ────────────────────────────────────────────────────────────

function CardMediaItem({
  item,
  style,
  onOpen,
  onLongPress,
}: {
  item: MediaItem;
  style: object;
  onOpen: () => void;
  onLongPress?: () => void;
}) {
  if (item.type === 'audio') {
    return (
      <Pressable style={style} onPress={onOpen} onLongPress={onLongPress} delayLongPress={220}>
        <AudioAttachmentPlayer uri={item.url} />
      </Pressable>
    );
  }

  if (item.type === 'video') {
    return (
      <Pressable style={[style, styles.videoContainer]} onPress={onOpen} onLongPress={onLongPress} delayLongPress={220}>
        {item.thumbnailUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            recyclingKey={item.thumbnailUrl}
          />
        ) : null}
        <View style={[styles.videoPlaceholder, item.thumbnailUrl && styles.videoPlaceholderOverlay]}>
          <Feather name="play-circle" size={40} color="#FFF" />
          {!item.thumbnailUrl && <Text style={styles.watchText}>Watch Video</Text>}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onOpen} onLongPress={onLongPress} delayLongPress={220} style={{ position: 'relative' }}>
      <Image
        source={{ uri: item.url }}
        style={style}
        contentFit="cover"
        recyclingKey={item.url.toLowerCase().endsWith('.gif') ? undefined : item.url}
      />
      {!!item.caption && (
        <View style={styles.captionBadge}>
          <Text style={styles.captionBadgeText}>📝</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 12,
  },
  cardWrapperBadged: {
    marginTop: 14,
  },
  card: {
    // no marginBottom — wrapper handles spacing
  },
  cornerBadge: {
    position: 'absolute',
    top: -12,
    left: 10,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  cornerBadgeEmoji: {
    fontSize: 12,
  },
  cornerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
  },
  expiryBadge: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  postText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  singleImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  carouselImage: {
    width: '100%',
    height: 200,
    overflow: 'hidden',
  },
  videoContainer: {
    backgroundColor: '#1a1a1a',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  videoPlaceholderOverlay: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  watchText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBubbleEmoji: {
    fontSize: 14,
    lineHeight: 16,
  },
  firstReactText: {
    fontSize: 11,
    opacity: 0.55,
  },
  captionBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionBadgeText: {
    fontSize: 11,
  },
});
