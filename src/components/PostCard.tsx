import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Carousel } from '@/components/ui/Carousel';
import { isStatusActive } from '@/components/NowStatusBadge';
import { UserProfileModal } from '@/components/UserProfileModal';
import { useAppSelector } from '@/store/hooks';
import {
  selectPostAuthor,
  selectPostChannel,
} from '@/store/slices/postsSlice';
import { getRelativeTime } from '@/lib/timeUtils';
import { getColorPair } from '@/lib/channel/channel.utils';
import { getPostAuthorName } from '@/lib/post/post.utils';
import type { Post } from '@/models/types';
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

  const firstMediaItem = post.media?.[0];
  const hasVideo = firstMediaItem?.type === 'video' && post.media?.length === 1;
  
  // Note: Hook must be called unconditionally per React rules.
  // When hasVideo is false, we pass an empty string which creates a minimal player instance.
  const videoPlayer = useVideoPlayer(
    hasVideo ? firstMediaItem.url : '',
    (player) => {
      if (hasVideo) {
        player.loop = true;
        player.muted = true;
        player.play();
      }
    }
  );

  // Create video players for carousel items - hooks must be called unconditionally
  const carouselVideoPlayers = useMemo(() => {
    if (!post.media || post.media.length <= 1) return [];
    return post.media.map(item => 
      item.type === 'video' ? item.url : ''
    );
  }, [post.media]);

  // Create players for all carousel video URLs
  const player0 = useVideoPlayer(carouselVideoPlayers[0] || '', (p) => {
    if (carouselVideoPlayers[0]) { p.loop = true; p.muted = true; p.play(); }
  });
  const player1 = useVideoPlayer(carouselVideoPlayers[1] || '', (p) => {
    if (carouselVideoPlayers[1]) { p.loop = true; p.muted = true; p.play(); }
  });
  const player2 = useVideoPlayer(carouselVideoPlayers[2] || '', (p) => {
    if (carouselVideoPlayers[2]) { p.loop = true; p.muted = true; p.play(); }
  });
  const player3 = useVideoPlayer(carouselVideoPlayers[3] || '', (p) => {
    if (carouselVideoPlayers[3]) { p.loop = true; p.muted = true; p.play(); }
  });

  const carouselPlayers = [player0, player1, player2, player3];

  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };
  const authorName = getPostAuthorName(author, currentUser);
  const hasMultipleMedia = post.media && post.media.length > 1;
  const isOtherUser = author && currentUser && author.id !== currentUser.id;
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  return (
    <Card style={styles.card}>
      {/* Tappable header + text area */}
      <Pressable onPress={onNavigate}>
        <View style={styles.header}>
          <Pressable
            onPress={isOtherUser ? () => setProfileModalOpen(true) : undefined}
          >
            <Avatar
              preset={author?.avatar || 'moon'}
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
              item.type === 'video' ? (
                <View key={`media-${index}`} style={[styles.carouselImage, styles.videoContainer]}>
                  <ActivityIndicator style={StyleSheet.absoluteFill} size="large" color="#666" />
                  <VideoView
                    player={carouselPlayers[index]}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={true}
                  />
                </View>
              ) : (
                <Image
                  key={`media-${index}`}
                  source={{ uri: item.url }}
                  style={styles.carouselImage}
                  contentFit="cover"
                />
              )
            ))}
          </Carousel>
        ) : (
          <Pressable onPress={onNavigate}>
            {post.media[0].type === 'video' ? (
              <View style={[styles.singleImage, styles.videoContainer]}>
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
                style={styles.singleImage}
                contentFit="cover"
              />
            )}
          </Pressable>
        )
      ) : null}

      {/* Tappable footer */}
      <Pressable onPress={onNavigate}>
        <View style={styles.footer}>
          {post.reactions.length > 0 && (
            <Text style={[styles.metaText, { color: theme.mutedForeground }]}>
              {post.reactions.length} reaction
              {post.reactions.length !== 1 ? 's' : ''}
            </Text>
          )}
          {post.comments.length > 0 && (
            <Text style={[styles.metaText, { color: theme.mutedForeground }]}>
              {post.comments.length} comment
              {post.comments.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </Pressable>

      {/* User profile modal for other users */}
      <UserProfileModal
        visible={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={author}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
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
  footer: {
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontSize: 12,
  },
});
