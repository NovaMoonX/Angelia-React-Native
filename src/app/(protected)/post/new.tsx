import React, { useState, useMemo } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
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
import { MAX_FILES } from '@/models/constants';
import type { MediaFile } from '@/components/PostCreateMediaUploader';
import type { Post } from '@/models/types';

export default function PostCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const canPublish = (text.trim().length > 0 || media.length > 0) && !!selectedChannel;

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

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

      if (media.length > 0) {
        await Promise.all(
          media.map((file) =>
            uploadPostMedia(postId, file.uri, file.name, file.type)
          )
        );
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
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
    >
      {/* Top bar: Cancel + Post */}
      <View style={[styles.topBar, { borderBottomColor: theme.border, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.cancelText, { color: theme.foreground }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={!canPublish || loading}
          style={[
            styles.postButton,
            {
              backgroundColor: canPublish ? theme.primary : theme.muted,
              opacity: loading ? 0.6 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.postButtonText,
              { color: canPublish ? theme.primaryForeground : theme.mutedForeground },
            ]}
          >
            {loading ? 'Posting...' : 'Post'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Channel selector */}
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

        {/* Compose area: avatar + text */}
        <View style={styles.composeRow}>
          <Avatar
            preset={currentUser?.avatar || 'moon'}
            size="md"
            style={{ marginTop: 2 }}
          />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="What's happening?"
            placeholderTextColor={theme.mutedForeground}
            multiline
            maxLength={2000}
            autoFocus
            style={[
              styles.composeInput,
              { color: theme.foreground },
            ]}
          />
        </View>

        {/* Character count */}
        {text.length > 0 && (
          <Text style={[styles.charCount, { color: theme.mutedForeground }]}>
            {text.length}/2000
          </Text>
        )}

        {/* Media preview strip */}
        {media.length > 0 && (
          <FlatList
            data={media}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => `media-${i}`}
            contentContainerStyle={styles.mediaStrip}
            renderItem={({ item, index }) => (
              <View style={[styles.mediaThumb, { borderColor: theme.border }]}>
                <Image source={{ uri: item.uri }} style={styles.mediaImage} />
                <Pressable
                  style={styles.mediaRemove}
                  onPress={() => removeMedia(index)}
                >
                  <Feather name="x" size={12} color="#FFF" />
                </Pressable>
              </View>
            )}
          />
        )}
      </ScrollView>

      {/* Action toolbar */}
      <View
        style={[
          styles.toolbar,
          {
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <View style={styles.toolbarActions}>
          <Pressable
            style={styles.toolbarButton}
            onPress={() => router.push('/(protected)/camera')}
            hitSlop={8}
          >
            <Feather name="camera" size={22} color={theme.primary} />
          </Pressable>
          <Pressable
            style={styles.toolbarButton}
            onPress={() =>
              router.push({
                pathname: '/(protected)/gallery',
                params: { existingMedia: JSON.stringify(media) },
              })
            }
            hitSlop={8}
          >
            <Feather name="image" size={22} color={theme.primary} />
          </Pressable>
        </View>

        {media.length > 0 && (
          <Text style={[styles.mediaCount, { color: theme.mutedForeground }]}>
            {media.length}/{MAX_FILES}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  channelRow: {
    gap: 8,
    paddingBottom: 12,
  },
  composeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  composeInput: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    textAlignVertical: 'top',
    minHeight: 100,
    paddingTop: 4,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 4,
  },
  mediaStrip: {
    gap: 8,
    paddingVertical: 12,
  },
  mediaThumb: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: 20,
  },
  toolbarButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaCount: {
    fontSize: 13,
    fontWeight: '500',
  },
});
