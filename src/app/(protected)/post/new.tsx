import React, { useState, useMemo } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { VideoView, useVideoPlayer } from 'expo-video';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { NowStatusModal } from '@/components/NowStatusModal';
import { isStatusActive } from '@/components/NowStatusBadge';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { getColorPair } from '@/lib/channel/channel.utils';
import { selectUserChannels } from '@/store/slices/channelsSlice';
import { uploadPost } from '@/store/actions/postActions';
import { saveStatus } from '@/store/actions/userActions';
import { KEYBOARD_VERTICAL_OFFSET, KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { MAX_FILES, POST_TIERS } from '@/models/constants';
import type { UserStatus, PostTier } from '@/models/types';
import type { MediaFile } from '@/components/PostCreateMediaUploader';

export default function PostCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    capturedMedia?: string;
    existingText?: string;
    existingChannel?: string;
    notificationPrompt?: string;
  }>();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const userChannels = useAppSelector((state) =>
    selectUserChannels(state, state.users.currentUser?.id || '')
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
    params.existingChannel || userChannels[0]?.id || ''
  );
  const [text, setText] = useState(params.existingText || '');
  const [selectedTier, setSelectedTier] = useState<PostTier>('everyday');
  const [media, setMedia] = useState<MediaFile[]>(initialMedia);
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaFile | null>(null);

  // Status prompt state — only shown when user has no active status
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const hasActiveStatus = isStatusActive(currentUser?.status);

  const atMaxFiles = media.length >= MAX_FILES;

  const placeholderByTier: Record<PostTier, string> = {
    'everyday': "Hey! What's going on? 👋",
    'worth-knowing': "Got something the crew should know? 👀",
    'big-news': "Heads up! What's happening? 🚨",
  };

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
      await dispatch(
        uploadPost({ channelId: selectedChannel, text, media, tier: selectedTier })
      ).unwrap();

      // Save the pending status only after the post is created successfully
      if (pendingStatus) {
        try {
          await dispatch(saveStatus(pendingStatus)).unwrap();
        } catch {
          // Status save failure shouldn't block the post success flow
        }
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
      <View style={[styles.topBar, { borderBottomColor: theme.border, paddingTop: isDemo ? 12 : insets.top + 8 }]}>
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
        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Channel</Text>
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

        {/* Priority selector */}
        <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Priority</Text>
        <View style={styles.tierRow}>
          {POST_TIERS.map((opt) => {
            const isSelected = selectedTier === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSelectedTier(opt.value)}
                style={[
                  styles.tierPill,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.muted,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text style={styles.tierPillEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.tierPillLabel,
                    { color: isSelected ? theme.primaryForeground : theme.mutedForeground },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Notification prompt banner — shown when arriving from a daily reminder tap */}
        {!!params.notificationPrompt && (
          <View style={[styles.notifBanner, { backgroundColor: theme.secondary }]}>
            <Text style={[styles.notifBannerText, { color: theme.secondaryForeground }]}>
              {params.notificationPrompt}
            </Text>
          </View>
        )}

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
            placeholder={placeholderByTier[selectedTier]}
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

        {/* Status prompt — shown when user has no active status */}
        {!hasActiveStatus && (
          <Pressable
            style={[styles.statusPrompt, { borderColor: theme.border }]}
            onPress={() => setStatusModalOpen(true)}
            accessibilityLabel={pendingStatus ? 'Edit status' : 'Add status to post'}
          >
            {pendingStatus ? (
              <View style={styles.statusPromptInner}>
                <Text style={styles.statusPromptEmoji}>{pendingStatus.emoji}</Text>
                <Text
                  style={[styles.statusPromptText, { color: theme.foreground }]}
                  numberOfLines={1}
                >
                  {pendingStatus.text}
                </Text>
                <Pressable
                  onPress={() => setPendingStatus(null)}
                  hitSlop={8}
                  accessibilityLabel="Clear status"
                >
                  <Feather name="x" size={14} color={theme.mutedForeground} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.statusPromptInner}>
                <Feather name="smile" size={15} color={theme.mutedForeground} />
                <Text style={[styles.statusPromptLabel, { color: theme.mutedForeground }]}>
                  Add a status to your post
                </Text>
              </View>
            )}
          </Pressable>
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
              <Pressable
                style={[styles.mediaThumb, { borderColor: theme.border }]}
                onPress={() => setPreviewItem(item)}
              >
                <Image source={{ uri: item.uri }} style={styles.mediaImage} />
                {item.type.startsWith('video/') && (
                  <View style={styles.videoOverlay}>
                    <Feather name="play" size={18} color="#FFF" />
                  </View>
                )}
                <Pressable
                  style={styles.mediaRemove}
                  onPress={() => removeMedia(index)}
                  hitSlop={8}
                >
                  <Feather name="x" size={12} color="#FFF" />
                </Pressable>
              </Pressable>
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
            style={[styles.toolbarButton, atMaxFiles && styles.toolbarButtonDisabled]}
            onPress={() =>
              router.replace({
                pathname: '/(protected)/camera',
                params: {
                  existingMedia: JSON.stringify(media),
                  existingText: text,
                  existingChannel: selectedChannel,
                },
              })
            }
            disabled={atMaxFiles}
            hitSlop={8}
          >
            <Feather name="camera" size={22} color={atMaxFiles ? theme.mutedForeground : theme.primary} />
          </Pressable>
          <Pressable
            style={[styles.toolbarButton, atMaxFiles && styles.toolbarButtonDisabled]}
            onPress={() =>
              router.replace({
                pathname: '/(protected)/gallery',
                params: {
                  existingMedia: JSON.stringify(media),
                  existingText: text,
                  existingChannel: selectedChannel,
                },
              })
            }
            disabled={atMaxFiles}
            hitSlop={8}
          >
            <Feather name="image" size={22} color={atMaxFiles ? theme.mutedForeground : theme.primary} />
          </Pressable>
        </View>

        {media.length > 0 && (
          <Text style={[styles.mediaCount, { color: atMaxFiles ? '#EF4444' : theme.mutedForeground }]}>
            {media.length}/{MAX_FILES}
          </Text>
        )}
      </View>

      {/* Media preview modal */}
      {previewItem && (
        <MediaPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
      )}

      {/* Status modal — status is stored locally until post succeeds */}
      <NowStatusModal
        visible={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onSave={(status) => {
          setPendingStatus(status);
          setStatusModalOpen(false);
        }}
        onClear={() => {
          setPendingStatus(null);
          setStatusModalOpen(false);
        }}
        currentStatus={pendingStatus}
      />
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
    paddingBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 14,
    marginTop: 2,
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  tierPillEmoji: {
    fontSize: 13,
  },
  tierPillLabel: {
    fontSize: 12,
    fontWeight: '500',
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
  toolbarButtonDisabled: {
    opacity: 0.4,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  statusPromptInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusPromptEmoji: {
    fontSize: 16,
  },
  statusPromptText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  statusPromptLabel: {
    fontSize: 14,
  },
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  notifBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});

// ── Media preview modal ────────────────────────────────────────────────────

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={previewStyles.videoView}
      contentFit="contain"
      nativeControls
    />
  );
}

function MediaPreviewModal({
  item,
  onClose,
}: {
  item: MediaFile;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isVideo = item.type.startsWith('video/');
  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <View style={[previewStyles.overlay, { paddingBottom: insets.bottom }]}>
        <Pressable style={previewStyles.closeButton} onPress={onClose} hitSlop={12}>
          <Feather name="x" size={26} color="#FFF" />
        </Pressable>
        {isVideo ? (
          <VideoPreview uri={item.uri} />
        ) : (
          <Image
            source={{ uri: item.uri}}
            style={previewStyles.image}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );
}

const previewStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
});
