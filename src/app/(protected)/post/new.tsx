import React, { useState, useMemo } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import {
  PostCreateMediaUploader,
  type MediaFile,
} from '@/components/PostCreateMediaUploader';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { getColorPair } from '@/lib/channel/channel.utils';
import { selectUserChannels } from '@/store/slices/channelsSlice';
import { addPost } from '@/store/slices/postsSlice';
import { createPost } from '@/services/firebase/firestore';
import { uploadPostMedia } from '@/services/firebase/storage';
import { generateId } from '@/utils/generateId';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import type { Post } from '@/models/types';

export default function PostCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ capturedMedia?: string }>();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const userChannels = useAppSelector((state) =>
    selectUserChannels(state, currentUser?.id || '')
  );

  const initialMedia = useMemo<MediaFile[]>(() => {
    if (!params.capturedMedia) return [];
    try {
      return JSON.parse(params.capturedMedia) as MediaFile[];
    } catch {
      return [];
    }
  }, [params.capturedMedia]);

  const [selectedChannel, setSelectedChannel] = useState(
    userChannels[0]?.id || ''
  );
  const [text, setText] = useState('');
  const [media, setMedia] = useState<MediaFile[]>(initialMedia);
  const [loading, setLoading] = useState(false);

  const selectedChannelObj = useMemo(
    () => userChannels.find((ch) => ch.id === selectedChannel),
    [userChannels, selectedChannel]
  );

  const handleSubmit = async () => {
    if (!selectedChannel) {
      addToast({ type: 'warning', title: 'Please select a channel' });
      return;
    }
    if (!text.trim() && media.length === 0) {
      addToast({
        type: 'warning',
        title: 'Please add some text or media',
      });
      return;
    }
    if (!currentUser) return;

    setLoading(true);
    try {
      const postId = generateId('nano');
      const post: Post = {
        id: postId,
        authorId: currentUser.id,
        channelId: selectedChannel,
        text: text.trim(),
        media: null,
        timestamp: Date.now(),
        reactions: [],
        comments: [],
        conversationEnrollees: [],
        markedForDeletionAt: null,
        status: media.length > 0 ? 'uploading' : 'ready',
      };

      if (isDemo) {
        dispatch(addPost({ ...post, status: 'ready' }));
        addToast({ type: 'success', title: 'Post created!' });
        router.back();
        return;
      }

      await createPost(post);

      // Upload media if any
      if (media.length > 0) {
        const mediaUrls = await Promise.all(
          media.map((file) =>
            uploadPostMedia(postId, file.uri, file.name, file.type)
          )
        );
        // Update post with media URLs — handled by real-time listener
      }

      addToast({ type: 'success', title: 'Post created!' });
      router.back();
    } catch (err) {
      addToast({
        type: 'error',
        title:
          err instanceof Error ? err.message : 'Failed to create post',
      });
    } finally {
      setLoading(false);
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
      {/* Prominent media preview (when arriving from camera) */}
      {media.length > 0 && initialMedia.length > 0 && (
        <View style={styles.heroMediaSection}>
          <Image
            source={{ uri: media[0].uri }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {media.length > 1 && (
            <View style={styles.heroExtraCount}>
              <Text style={styles.heroExtraText}>+{media.length - 1}</Text>
            </View>
          )}
          <Pressable
            style={styles.heroRetakeButton}
            onPress={() => router.replace('/(protected)/camera')}
            hitSlop={8}
          >
            <Feather name="camera" size={16} color="#FFF" />
            <Text style={styles.heroRetakeText}>Retake</Text>
          </Pressable>
        </View>
      )}

      {/* Channel Selector */}
      <View style={styles.section}>
        <Label>Post to Channel *</Label>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.channelRow}
        >
          {userChannels.map((ch) => {
            const colors = getColorPair(ch);
            const isSelected = selectedChannel === ch.id;
            return (
              <Pressable
                key={ch.id}
                onPress={() => setSelectedChannel(ch.id)}
              >
                <Badge
                  style={{
                    backgroundColor: isSelected
                      ? colors.backgroundColor
                      : theme.muted,
                    borderColor: isSelected
                      ? colors.backgroundColor
                      : theme.border,
                    borderWidth: 1,
                  }}
                  textStyle={{
                    color: isSelected
                      ? colors.textColor
                      : theme.foreground,
                  }}
                >
                  {ch.name}
                </Badge>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Text */}
      <View style={styles.section}>
        <Label>What's on your mind?</Label>
        <Textarea
          value={text}
          onChangeText={setText}
          placeholder="Share an update with your family..."
          rows={4}
          maxLength={2000}
        />
      </View>

      {/* Media uploader — shown collapsed if arriving from camera, open if arriving directly */}
      <View style={styles.section}>
        <Label>Photos & Videos</Label>
        <PostCreateMediaUploader value={media} onValueChange={setMedia} />
      </View>

      {/* Submit */}
      <Button onPress={handleSubmit} loading={loading} style={{ marginTop: 12 }}>
        Publish Post
      </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 20,
    gap: 8,
  },
  channelRow: {
    gap: 8,
    paddingVertical: 4,
  },
  heroMediaSection: {
    marginHorizontal: -20,
    marginBottom: 20,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  heroExtraCount: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroExtraText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  heroRetakeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  heroRetakeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
