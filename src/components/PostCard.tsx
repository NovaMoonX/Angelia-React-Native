import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Carousel } from '@/components/ui/Carousel';
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
  const videoPlayer = useVideoPlayer(
    firstMediaItem?.type === 'video' && post.media?.length === 1
      ? firstMediaItem.url
      : '',
    (player) => {
      player.loop = true;
      player.muted = true;
    }
  );

  const colors = channel
    ? getColorPair(channel)
    : { backgroundColor: '#6366F1', textColor: '#FFF' };
  const authorName = getPostAuthorName(author, currentUser);

  return (
    <Pressable onPress={onNavigate}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Avatar preset={author?.avatar || 'moon'} size="sm" />
          <View style={styles.headerText}>
            <Text style={[styles.authorName, { color: theme.foreground }]}>
              {authorName}
            </Text>
            <Text style={[styles.time, { color: theme.mutedForeground }]}>
              {getRelativeTime(post.timestamp)}
            </Text>
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

        {post.media && post.media.length > 0 ? (
          post.media.length === 1 ? (
            post.media[0].type === 'video' ? (
              <VideoView
                player={videoPlayer}
                style={styles.singleImage}
                contentFit="cover"
                nativeControls={false}
              />
            ) : (
              <Image
                source={{ uri: post.media[0].url }}
                style={styles.singleImage}
                contentFit="cover"
              />
            )
          ) : (
            <Carousel>
              {post.media.map((item, index) => (
                item.type === 'video' ? (
                  <View key={`media-${index}`} style={styles.carouselImage}>
                    <Text style={[styles.videoLabel, { color: theme.mutedForeground }]}>
                      📹 Video
                    </Text>
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
          )
        ) : null}

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
      </Card>
    </Pressable>
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
    marginBottom: 12,
  },
  carouselImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontSize: 12,
  },
  videoLabel: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 80,
  },
});
