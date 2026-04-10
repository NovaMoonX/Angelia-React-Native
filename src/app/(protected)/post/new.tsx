import React, { useState, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const userChannels = useAppSelector((state) =>
    selectUserChannels(state, currentUser?.id || '')
  );

  const [selectedChannel, setSelectedChannel] = useState(
    userChannels[0]?.id || ''
  );
  const [text, setText] = useState('');
  const [media, setMedia] = useState<MediaFile[]>([]);
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
          rows={6}
          maxLength={2000}
        />
      </View>

      {/* Media */}
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
    padding: 20,
  },
  section: {
    marginBottom: 20,
    gap: 8,
  },
  channelRow: {
    gap: 8,
    paddingVertical: 4,
  },
});
