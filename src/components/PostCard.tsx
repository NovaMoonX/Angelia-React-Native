import React, { useState, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Carousel } from '@/components/ui/Carousel';
import { isStatusActive } from '@/components/NowStatusBadge';
import { UserProfileModal } from '@/components/UserProfileModal';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { useAppSelector } from '@/store/hooks';
import {
  selectPostAuthor,
  selectPostChannel,
} from '@/store/slices/postsSlice';
import { getRelativeTime } from '@/lib/timeUtils';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName, getPostExpiryInfo } from '@/lib/post/post.utils';
import { POST_TIERS } from '@/models/constants';
import type { Post, MediaItem } from '@/models/types';
import { useTheme } from '@/hooks/useTheme';

interface PostCardProps {
  post: Post;
  onNavigate?: () => void;
}

export function PostCard({ post, onNavigate }: PostCardProps) {
  const author = useAppSelector((state) =>
    selectPostAuthor(state, post.authorId)
  );
  const channel = useAppSelector((state) =>
    selectPostChannel(state, post.channelId)
  );
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const { theme } = useTheme();

  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };
  const authorName = getPostAuthorName(author, currentUser);
  const hasMultipleMedia = post.media && post.media.length > 1;
  const isOtherUser = author && currentUser && author.id !== currentUser.id;
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const hasTierBadge = post.tier === 'worth-knowing' || post.tier === 'big-news';
  const tierBadgeConfig = post.tier ? POST_TIERS.find((t) => t.value === post.tier) ?? null : null;

  const expiryInfo = channel != null
    ? getPostExpiryInfo(post.timestamp, channel.isDaily === true)
    : null;

  const topReactions = useMemo(() => {
    const counts: Record<string, number> = {};
    post.reactions.forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emoji]) => emoji);
  }, [post.reactions]);

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
      <Card style={styles.card}>
        {/* Tappable header + text area */}
        <Pressable onPress={onNavigate}>
          <View style={styles.header}>
            <Pressable
              onPress={isOtherUser ? () => setProfileModalOpen(true) : undefined}
            >
              <Avatar
                user={author}
                size="sm"
                statusEmoji={isStatusActive(author?.status) ? author?.status?.emoji : undefined}
              />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={[styles.authorName, { color: theme.foreground }]}>
                {authorName}
              </Text>
              <View style={styles.headerMeta}>
                <Text style={[styles.time, { color: theme.mutedForeground }]}>
                  {getRelativeTime(post.timestamp)}
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
                {channel.name}
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
                onOpen={() => setMediaViewer({ url: item.url, type: item.type })}
              />
            ))}
          </Carousel>
        ) : (
          <CardMediaItem
            item={post.media[0]}
            style={styles.singleImage}
            onOpen={() => setMediaViewer({ url: post.media![0].url, type: post.media![0].type })}
          />
        )
      ) : null}

      {/* Tappable footer */}
      {hasFooter && (
        <Pressable onPress={onNavigate}>
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
          visible
          onClose={() => setMediaViewer(null)}
        />
      )}
    </Card>
    </View>
  );
}

// ── CardMediaItem ────────────────────────────────────────────────────────────

function CardMediaItem({
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
          <Feather name="play-circle" size={40} color="#FFF" />
          {!item.thumbnailUrl && <Text style={styles.watchText}>Watch Video</Text>}
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
    fontSize: 12,
    fontStyle: 'italic',
  },
});
