import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Keyboard,
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
import { Image } from 'expo-image';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { NowStatusModal } from '@/components/NowStatusModal';
import { isStatusActive } from '@/components/NowStatusBadge';
import { MediaViewerModal } from '@/components/MediaViewerModal';
import { PostCountdownOverlay } from '@/components/PostCountdownOverlay';
import { useAppSelector } from '@/store/hooks';
import { selectPostById } from '@/store/slices/postsSlice';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useActionModal } from '@/hooks/useActionModal';
import { getColorPair } from '@/lib/channel/channel.utils';
import {
  selectCurrentUserDailyChannel,
  selectCurrentUserCustomChannels,
} from '@/store/crossSelectors/channelSelectors';
import { KEYBOARD_BEHAVIOR } from '@/constants/layout';
import { MAX_FILES, POST_TIERS, POST_CREATE_DRAFT_KEY, AUDIO_TITLE_MAX_LENGTH, AUDIO_CAPTION_MAX_LENGTH } from '@/models/constants';
import { generateVideoThumbnail } from '@/utils/generateVideoThumbnail';
import type { VideoThumbnail } from 'expo-video';
import type { UserStatus, PostTier } from '@/models/types';
import type { MediaFile } from '@/components/PostCreateMediaUploader';

type PostCreateDraft = {
  text: string;
  selectedChannel: string;
  selectedTier: PostTier;
  media: MediaFile[];
  pendingStatus: UserStatus | null;
  showCaptionHint: boolean;
  showReorderHint: boolean;
  showVideoUploadNotice: boolean;
};

function normalizeIncomingMedia(files: MediaFile[]): MediaFile[] {
  return files.map((item) => {
    const prefersExistingUrl = item.type.endsWith('/remote') && Boolean(item.existingUrl);
    const resolvedUri = prefersExistingUrl
      ? (item.existingUrl as string)
      : (item.uri || item.existingUrl || '');

    return {
      ...item,
      uri: resolvedUri,
      title: item.title ?? null,
      caption: item.caption ?? null,
    };
  });
}

function getMediaPreviewUri(item: MediaFile): string {
  return item.uri || item.existingUrl || '';
}

function toComposerMediaType(type: 'image' | 'video' | 'audio'): string {
  if (type === 'video') {
    return 'video/remote';
  }
  if (type === 'audio') {
    return 'audio/remote';
  }
  return 'image/remote';
}

function getFileNameFromUrl(url: string, fallback: string): string {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split('/').pop();
    return base && base.length > 0 ? base : fallback;
  } catch {
    return fallback;
  }
}

function decodeMediaParam(value: string): MediaFile[] {
  try {
    return JSON.parse(value) as MediaFile[];
  } catch {
    return JSON.parse(decodeURIComponent(value)) as MediaFile[];
  }
}

function encodeMediaParam(files: MediaFile[]): string {
  return encodeURIComponent(JSON.stringify(files));
}

export default function PostCreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    editPostId?: string;
    capturedMedia?: string;
    existingText?: string;
    existingChannel?: string;
    existingTier?: string;
    existingPendingStatus?: string;
    notificationPrompt?: string;
  }>();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const { confirm } = useActionModal();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const editingPost = useAppSelector((state) => {
    return selectPostById(state, params.editPostId ?? '');
  });
  const isEditMode = Boolean(params.editPostId);
  const dailyChannel = useAppSelector(selectCurrentUserDailyChannel);
  const customChannels = useAppSelector(selectCurrentUserCustomChannels);

  // Daily circle first, then custom circles
  const sortedUserChannels = useMemo(
    () => [...(dailyChannel ? [dailyChannel] : []), ...customChannels],
    [dailyChannel, customChannels],
  );

  const dailyChannelId = dailyChannel?.id ?? '';

  const draftStorageKey = !isEditMode && currentUser?.id ? POST_CREATE_DRAFT_KEY(currentUser.id) : null;
  const didHydrateDraftRef = useRef(false);
  const hasIncomingNavigationState =
    params.capturedMedia != null ||
    params.existingText != null ||
    params.existingChannel != null ||
    params.existingTier != null ||
    params.existingPendingStatus != null;

  const initialMedia = useMemo<MediaFile[]>(() => {
    if (params.capturedMedia) {
      try {
        const parsed = decodeMediaParam(params.capturedMedia);
        return normalizeIncomingMedia(parsed);
      } catch {
        return [];
      }
    }

    if (!isEditMode || !editingPost?.media) {
      return [];
    }

    const mapped = editingPost.media.map((item, index) => {
      return {
        uri: item.url,
        existingUrl: item.url,
        name: getFileNameFromUrl(item.url, `media-${index}`),
        type: toComposerMediaType(item.type),
        thumbnailUri: item.thumbnailUrl ?? null,
        title: item.title ?? null,
        caption: item.caption ?? null,
      };
    });
    return normalizeIncomingMedia(mapped);
  }, [editingPost?.media, isEditMode, params.capturedMedia]);

  const initialPendingStatus = useMemo<UserStatus | null>(() => {
    if (!params.existingPendingStatus) return null;
    try {
      return JSON.parse(params.existingPendingStatus) as UserStatus;
    } catch {
      return null;
    }
  }, [params.existingPendingStatus]);

  const [selectedChannel, setSelectedChannel] = useState(
    params.existingChannel || editingPost?.channelId || dailyChannelId || sortedUserChannels[0]?.id || ''
  );

  // Once channels load (and no explicit selection was passed in), default to daily circle
  useEffect(() => {
    if (params.existingChannel) return; // already set from navigation params
    if (selectedChannel) return;        // already resolved on mount
    if (sortedUserChannels.length === 0) return;
    setSelectedChannel(dailyChannelId || sortedUserChannels[0].id);
  }, [dailyChannelId, sortedUserChannels, params.existingChannel, selectedChannel]);

  const [text, setText] = useState(params.existingText || editingPost?.text || '');
  const [selectedTier, setSelectedTier] = useState<PostTier>(
    params.existingTier === 'worth-knowing' || params.existingTier === 'big-news' || params.existingTier === 'everyday'
      ? params.existingTier
      : (editingPost?.tier ?? 'everyday')
  );
  const [media, setMedia] = useState<MediaFile[]>(initialMedia);
  const [previewItem, setPreviewItem] = useState<{ uri: string; type: 'image' | 'video' | 'audio'; caption: string | null; title: string | null } | null>(null);

  // Video thumbnails keyed by media index
  const [videoThumbnails, setVideoThumbnails] = useState<Record<number, VideoThumbnail | null>>({});
  const thumbnailsRef = useRef<Record<number, boolean>>({});

  // Status prompt state — only shown when user has no active status
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(initialPendingStatus);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const hasActiveStatus = isStatusActive(currentUser?.status);
  const [reorderIndex, setReorderIndex] = useState<number | null>(null);
  const [captionTargetIndex, setCaptionTargetIndex] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');

  const [showCaptionHint, setShowCaptionHint] = useState(true);
  const [showReorderHint, setShowReorderHint] = useState(true);
  const [showVideoUploadNotice, setShowVideoUploadNotice] = useState(true);

  const atMaxFiles = media.length >= MAX_FILES;

  useEffect(() => {
    if (!params.capturedMedia) return;
    setMedia(initialMedia);
  }, [initialMedia, params.capturedMedia]);

  useEffect(() => {
    if (params.existingText == null) return;
    setText(params.existingText);
  }, [params.existingText]);

  useEffect(() => {
    if (params.existingChannel == null) return;
    setSelectedChannel(params.existingChannel);
  }, [params.existingChannel]);

  useEffect(() => {
    if (
      params.existingTier !== 'everyday' &&
      params.existingTier !== 'worth-knowing' &&
      params.existingTier !== 'big-news'
    ) {
      return;
    }
    setSelectedTier(params.existingTier);
  }, [params.existingTier]);

  useEffect(() => {
    if (params.existingPendingStatus == null) return;
    setPendingStatus(initialPendingStatus);
  }, [initialPendingStatus, params.existingPendingStatus]);

  useEffect(() => {
    if (!isEditMode || !editingPost) {
      return;
    }
    if (params.existingText == null) {
      setText(editingPost.text ?? '');
    }
    if (params.existingChannel == null) {
      setSelectedChannel(editingPost.channelId ?? '');
    }
    if (params.existingTier == null) {
      setSelectedTier(editingPost.tier ?? 'everyday');
    }
    if (params.capturedMedia == null) {
      setMedia(initialMedia);
    }
  }, [
    editingPost,
    initialMedia,
    isEditMode,
    params.capturedMedia,
    params.existingChannel,
    params.existingText,
    params.existingTier,
  ]);

  useEffect(() => {
    if (didHydrateDraftRef.current) return;

    if (!draftStorageKey || hasIncomingNavigationState) {
      didHydrateDraftRef.current = true;
      return;
    }

    AsyncStorage.getItem(draftStorageKey)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as PostCreateDraft;
        if (parsed.text != null) setText(parsed.text);
        if (parsed.selectedChannel != null) setSelectedChannel(parsed.selectedChannel);
        if (parsed.selectedTier != null) setSelectedTier(parsed.selectedTier);
        if (Array.isArray(parsed.media)) setMedia(parsed.media);
        if (parsed.pendingStatus !== undefined) setPendingStatus(parsed.pendingStatus);
        if (parsed.showCaptionHint !== undefined) setShowCaptionHint(parsed.showCaptionHint);
        if (parsed.showReorderHint !== undefined) setShowReorderHint(parsed.showReorderHint);
        if (parsed.showVideoUploadNotice !== undefined) setShowVideoUploadNotice(parsed.showVideoUploadNotice);
      })
      .catch(() => {})
      .finally(() => {
        didHydrateDraftRef.current = true;
      });
  }, [draftStorageKey, hasIncomingNavigationState]);

  useEffect(() => {
    if (!draftStorageKey || !didHydrateDraftRef.current) return;

    const draft: PostCreateDraft = {
      text,
      selectedChannel,
      selectedTier,
      media,
      pendingStatus,
      showCaptionHint,
      showReorderHint,
      showVideoUploadNotice,
    };

    void AsyncStorage.setItem(draftStorageKey, JSON.stringify(draft)).catch(() => {});
  }, [
    draftStorageKey,
    media,
    pendingStatus,
    selectedChannel,
    selectedTier,
    showCaptionHint,
    showReorderHint,
    showVideoUploadNotice,
    text,
  ]);

  const clearLocalDraft = useCallback(async () => {
    if (!draftStorageKey) return;
    await AsyncStorage.removeItem(draftStorageKey).catch(() => {});
  }, [draftStorageKey]);

  const resetComposerState = useCallback(() => {
    if (isEditMode && editingPost) {
      setText(editingPost.text ?? '');
      setSelectedTier(editingPost.tier ?? 'everyday');
      setMedia(initialMedia);
      setPendingStatus(null);
      setVideoThumbnails({});
      thumbnailsRef.current = {};
      setReorderIndex(null);
      setCaptionTargetIndex(null);
      setCaptionDraft('');
      setPreviewItem(null);
      setShowCaptionHint(true);
      setShowReorderHint(true);
      setShowVideoUploadNotice(true);
      setSelectedChannel(editingPost.channelId ?? dailyChannelId ?? sortedUserChannels[0]?.id ?? '');
      return;
    }

    setText('');
    setSelectedTier('everyday');
    setMedia([]);
    setPendingStatus(null);
    setVideoThumbnails({});
    thumbnailsRef.current = {};
    setReorderIndex(null);
    setCaptionTargetIndex(null);
    setCaptionDraft('');
    setPreviewItem(null);
    setShowCaptionHint(true);
    setShowReorderHint(true);
    setShowVideoUploadNotice(true);
    setSelectedChannel(dailyChannelId || sortedUserChannels[0]?.id || '');
  }, [dailyChannelId, editingPost, initialMedia, isEditMode, sortedUserChannels]);

  const handleResetDraft = useCallback(async () => {
    const ok = await confirm({
      title: 'Reset this draft?',
      message: 'This will clear your text, media, status, and selections for this post.',
      destructive: true,
    });
    if (!ok) return;
    resetComposerState();
    await clearLocalDraft();
  }, [clearLocalDraft, confirm, resetComposerState]);

  const handleCancelDraft = useCallback(async () => {
    const hasContent =
      text.trim().length > 0 ||
      media.length > 0 ||
      pendingStatus != null ||
      selectedTier !== 'everyday';

    if (hasContent) {
      const ok = await confirm({
        title: 'Discard this draft?',
        message: 'Your current post draft will be removed.',
        destructive: true,
      });
      if (!ok) return;
    }

    await clearLocalDraft();
    if (isEditMode && params.editPostId) {
      router.replace({ pathname: '/(protected)/post/[id]', params: { id: params.editPostId } });
      return;
    }
    router.replace('/(protected)/feed');
  }, [
    clearLocalDraft,
    confirm,
    isEditMode,
    media.length,
    params.editPostId,
    pendingStatus,
    router,
    selectedTier,
    text,
  ]);

  // Countdown confirmation state
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getSelectedChannelName = (): string => {
    const ch = sortedUserChannels.find((c) => { return c.id === selectedChannel; });
    if (!ch) return 'Unknown Circle';
    if (ch.isDaily) return 'Daily';
    return ch.name;
  };

  const executePost = () => {
    router.replace({
      pathname: '/(protected)/post/uploading',
      params: {
        mode: isEditMode ? 'edit' : 'create',
        postId: params.editPostId,
        channelId: selectedChannel,
        text,
        mediaJson: JSON.stringify(media),
        tier: selectedTier,
        pendingStatusJson: pendingStatus ? JSON.stringify(pendingStatus) : '',
      },
    });
  };

  const handleCancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownVisible(false);
    setCountdownSeconds(5);
  };

  const handlePostNow = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownVisible(false);
    executePost();
  };

  useEffect(() => {
    if (!countdownVisible) return;

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!);
          countdownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [countdownVisible]);

  useEffect(() => {
    if (countdownVisible && countdownSeconds === 0) {
      setCountdownVisible(false);
      setCountdownSeconds(3);
      executePost();
    }
  }, [countdownSeconds, countdownVisible]);

  // Generate thumbnails for video items whenever media changes
  useEffect(() => {
    media.forEach((item, index) => {
      if (item.type.startsWith('video/') && !thumbnailsRef.current[index]) {
        thumbnailsRef.current[index] = true;
        generateVideoThumbnail(item.uri).then((thumb) => {
          setVideoThumbnails((prev) => ({ ...prev, [index]: thumb }));
        });
      }
    });
  }, [media]);

  const placeholderByTier: Record<PostTier, string> = {
    'everyday': "Hey! What's going on? 👋",
    'worth-knowing': "Got something the crew should know? 👀",
    'big-news': "Heads up! What's happening? 🚨",
  };

  const canPublish = text.trim().length > 0 && !!selectedChannel;
  const defaultChannelSelection = dailyChannelId || sortedUserChannels[0]?.id || '';
  const hasPostAdditions =
    text.trim().length > 0 ||
    media.length > 0 ||
    pendingStatus != null ||
    selectedTier !== 'everyday' ||
    selectedChannel !== defaultChannelSelection;

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
    setVideoThumbnails((prev) => reindexAfterRemoval(prev, index));
    thumbnailsRef.current = reindexAfterRemoval(
      Object.fromEntries(
        Object.entries(thumbnailsRef.current).filter(([k]) => Number(k) !== index)
      ) as Record<number, boolean>,
      index,
    );
  };

  const handleSubmit = () => {
    if (!selectedChannel) {
      addToast({ type: 'warning', title: 'Please select a circle' });
      return;
    }
    if (!text.trim()) {
      addToast({
        type: 'warning',
        title: "Don't forget to add some text! ✍️",
      });
      return;
    }
    if (!currentUser) return;

    setCountdownSeconds(3);
    setCountdownVisible(true);
    Keyboard.dismiss();
  };

  const openCaptionModal = (index: number) => {
    setShowCaptionHint(false);
    setCaptionTargetIndex(index);
    setCaptionDraft(media[index]?.caption ?? '');
    setTitleDraft(media[index]?.title ?? '');
  };

  const saveCaptions = () => {
    if (captionTargetIndex === null) { return; }
    const isAudioItem = media[captionTargetIndex]?.type.startsWith('audio/');
    setMedia((prev) => {
      return prev.map((item, i) => {
        if (i !== captionTargetIndex) { return item; }
        return {
          ...item,
          caption: captionDraft.trim() || null,
          ...(isAudioItem ? { title: titleDraft.trim() || null } : {}),
        };
      });
    });
    setCaptionTargetIndex(null);
  };

  const moveMedia = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= media.length) return;
    setMedia((prev) => {
      const next = [...prev];
      const temp = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = temp;
      return next;
    });
    setVideoThumbnails((prev) => {
      const next = { ...prev };
      const temp = next[fromIndex];
      next[fromIndex] = next[toIndex];
      next[toIndex] = temp;
      return next;
    });
    const tempRef = thumbnailsRef.current[fromIndex];
    thumbnailsRef.current[fromIndex] = thumbnailsRef.current[toIndex];
    thumbnailsRef.current[toIndex] = tempRef;
    setReorderIndex(toIndex);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={0}
    >
      {/* Top bar: Cancel + Post */}
      <View style={[styles.topBar, { borderBottomColor: theme.border, paddingTop: isDemo ? 12 : insets.top + 8 }]}>
        <View style={styles.topLeftActions}>
          <Pressable onPress={() => { void handleCancelDraft(); }} hitSlop={12}>
            <Text style={[styles.cancelText, { color: theme.foreground }]}>Cancel</Text>
          </Pressable>
          {!isEditMode && hasPostAdditions && (
            <Pressable onPress={() => { void handleResetDraft(); }} hitSlop={12}>
              <Text style={[styles.resetText, { color: theme.mutedForeground }]}>Reset</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={handleSubmit}
          disabled={!canPublish}
          style={[
            styles.postButton,
            {
              backgroundColor: canPublish ? theme.primary : theme.muted,
            },
          ]}
        >
          <Text
            style={[
              styles.postButtonText,
              { color: canPublish ? theme.primaryForeground : theme.mutedForeground },
            ]}
          >
            {isEditMode ? 'Save' : 'Post'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        onTouchStart={() => {
          if (reorderIndex !== null) {
            setReorderIndex(null);
          }
        }}
      >
        {/* Circle selector */}
        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Circle</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.channelRow}
        >
          {sortedUserChannels.map((ch) => {
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
            const activeBg = opt.badgeBg === 'transparent' ? theme.primary : opt.badgeBg;
            const activeText = opt.badgeText === 'transparent' ? theme.primaryForeground : opt.badgeText;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setSelectedTier(opt.value)}
                style={[
                  styles.tierPill,
                  {
                    backgroundColor: isSelected ? activeBg : theme.muted,
                    borderColor: isSelected ? activeBg : theme.border,
                  },
                ]}
              >
                <Text style={styles.tierPillEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.tierPillLabel,
                    { color: isSelected ? activeText : theme.mutedForeground },
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
            user={currentUser}
            size="md"
            style={{ marginTop: 2 }}
            showStatus={false}
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
        {!isEditMode && !hasActiveStatus && (
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
          <>
        {showCaptionHint && (
          <View style={[styles.featureHint, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <Text style={[styles.featureHintText, { color: theme.mutedForeground }]}> 
              Add a caption: tap the <Text style={{ fontWeight: '700' }}>T</Text> on any media item.
            </Text>
            <Pressable onPress={() => setShowCaptionHint(false)} hitSlop={8}>
              <Feather name="x" size={14} color={theme.mutedForeground} />
            </Pressable>
          </View>
        )}

        {showReorderHint && (
          <View style={[styles.featureHint, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <Text style={[styles.featureHintText, { color: theme.mutedForeground }]}> 
              Reorder media: long press any media item, then use arrows.
            </Text>
            <Pressable onPress={() => setShowReorderHint(false)} hitSlop={8}>
              <Feather name="x" size={14} color={theme.mutedForeground} />
            </Pressable>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mediaStrip}
        >
          {media.map((item, index) => {
            const isVideo = item.type.startsWith('video/');
            const isAudio = item.type.startsWith('audio/');
            const isGif = item.type === 'image/gif';
            const thumb = isVideo ? videoThumbnails[index] : null;
            const isSelected = reorderIndex === index;
            return (
              <Pressable
                key={`media-${index}`}
                style={[
                  styles.mediaThumb,
                  { borderColor: isSelected ? theme.primary : theme.border },
                  isSelected && styles.mediaThumbSelected,
                ]}
                onPress={() => {
                  if (reorderIndex !== null) {
                    setReorderIndex(null);
                    return;
                  }
                  setPreviewItem({ uri: getMediaPreviewUri(item), type: isVideo ? 'video' : isAudio ? 'audio' : 'image', caption: item.caption, title: item.title ?? null });
                }}
                onLongPress={() => {
                  setShowReorderHint(false);
                  setReorderIndex(index);
                }}
                delayLongPress={300}
              >
                {isAudio ? (
                  <View style={styles.mediaAudioCard}>
                    <Feather name="mic" size={20} color="#FFF" />
                    <Text style={styles.mediaAudioLabel} numberOfLines={1}>{item.title?.trim() || item.name}</Text>
                  </View>
                ) : (
                  <Image
                    source={thumb ?? { uri: getMediaPreviewUri(item) }}
                    style={styles.mediaImage}
                    contentFit="cover"
                    recyclingKey={isGif ? undefined : getMediaPreviewUri(item)}
                  />
                )}
                {isVideo && !isSelected && (
                  <View style={styles.videoOverlay}>
                    <Feather name="play" size={18} color="#FFF" />
                  </View>
                )}
                {/* Reorder arrows shown when this item is selected for reorder */}
                {isSelected && (
                  <View style={styles.reorderOverlay}>
                    <Pressable
                      onPress={() => moveMedia(index, 'left')}
                      disabled={index === 0}
                      hitSlop={6}
                      style={[styles.reorderArrow, index === 0 && styles.reorderArrowDisabled]}
                    >
                      <Feather name="chevron-left" size={16} color="#FFF" />
                    </Pressable>
                    <Feather name="move" size={14} color="#FFF" />
                    <Pressable
                      onPress={() => moveMedia(index, 'right')}
                      disabled={index === media.length - 1}
                      hitSlop={6}
                      style={[styles.reorderArrow, index === media.length - 1 && styles.reorderArrowDisabled]}
                    >
                      <Feather name="chevron-right" size={16} color="#FFF" />
                    </Pressable>
                  </View>
                )}
                {!isSelected && (
                  <Pressable
                    style={styles.mediaRemove}
                    onPress={() => {
                      removeMedia(index);
                      setReorderIndex(null);
                    }}
                    hitSlop={8}
                  >
                    <Feather name="x" size={12} color="#FFF" />
                  </Pressable>
                )}
                {/* Caption badge — shown when caption is set */}
                {!isSelected && item.caption && (
                  <Pressable
                    style={styles.mediaCaptionBadge}
                    onPress={() => openCaptionModal(index)}
                    hitSlop={8}
                  >
                    <Feather name="file-text" size={10} color="#FFF" />
                  </Pressable>
                )}
                {/* Add caption button — shown when no caption and not in reorder */}
                {!isSelected && !item.caption && (
                  <Pressable
                    style={styles.mediaAddCaption}
                    onPress={() => openCaptionModal(index)}
                    hitSlop={8}
                  >
                    <Feather name="type" size={10} color="#FFF" />
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
          </>
        )}

        {showVideoUploadNotice && (
          <View style={[styles.videoNoticeBanner, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <Feather name="alert-circle" size={14} color={theme.mutedForeground} />
            <Text style={[styles.videoNoticeText, { color: theme.mutedForeground }]}> 
              Heads up: uploading videos from gallery is flaky right now. For now, videos should be recorded in-app using the camera.
            </Text>
            <Pressable onPress={() => setShowVideoUploadNotice(false)} hitSlop={8}>
              <Feather name="x" size={14} color={theme.mutedForeground} />
            </Pressable>
          </View>
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
            onPress={() => {
              router.replace({
                pathname: '/(protected)/camera',
                params: {
                  editPostId: params.editPostId,
                  existingMedia: encodeMediaParam(media),
                  existingText: text,
                  existingChannel: selectedChannel,
                  existingTier: selectedTier,
                  existingPendingStatus: pendingStatus ? JSON.stringify(pendingStatus) : '',
                },
              });
            }}
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
                  editPostId: params.editPostId,
                  existingMedia: encodeMediaParam(media),
                  existingText: text,
                  existingChannel: selectedChannel,
                  existingTier: selectedTier,
                  existingPendingStatus: pendingStatus ? JSON.stringify(pendingStatus) : '',
                },
              })
            }
            disabled={atMaxFiles}
            hitSlop={8}
          >
            <Feather name="image" size={22} color={atMaxFiles ? theme.mutedForeground : theme.primary} />
          </Pressable>
          <Pressable
            style={[styles.toolbarButton, atMaxFiles && styles.toolbarButtonDisabled]}
            onPress={() =>
              router.replace({
                pathname: '/(protected)/audio-record',
                params: {
                  editPostId: params.editPostId,
                  existingMedia: encodeMediaParam(media),
                  existingText: text,
                  existingChannel: selectedChannel,
                  existingTier: selectedTier,
                  existingPendingStatus: pendingStatus ? JSON.stringify(pendingStatus) : '',
                },
              })
            }
            disabled={atMaxFiles}
            hitSlop={8}
          >
            <Feather name="mic" size={22} color={atMaxFiles ? theme.mutedForeground : theme.primary} />
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
        <MediaViewerModal
          uri={previewItem.uri}
          mediaType={previewItem.type}
          caption={previewItem.caption}
          title={previewItem.title}
          visible
          onClose={() => setPreviewItem(null)}
        />
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

      <PostCountdownOverlay
        visible={countdownVisible}
        circleName={getSelectedChannelName()}
        seconds={countdownSeconds}
        tier={selectedTier}
        mediaCount={media.length}
        pendingStatus={pendingStatus}
        onCancel={handleCancelCountdown}
        onPostNow={handlePostNow}
      />

      {/* Caption / title input modal */}
      {captionTargetIndex !== null && (
        <View style={styles.captionModal}>
          <Pressable style={styles.captionBackdrop} onPress={() => setCaptionTargetIndex(null)} />
          <View style={[styles.captionSheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + 16 }]}>
            <Text style={[styles.captionTitle, { color: theme.foreground }]}>
              {captionTargetIndex !== null && media[captionTargetIndex]?.type.startsWith('audio/') ? 'Edit clip' : 'Add a caption'}
            </Text>
            {captionTargetIndex !== null && media[captionTargetIndex]?.type.startsWith('audio/') && (
              <>
                <TextInput
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  placeholder="Clip title..."
                  placeholderTextColor={theme.mutedForeground}
                  maxLength={AUDIO_TITLE_MAX_LENGTH}
                  autoFocus
                  style={[styles.captionTitleInput, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background }]}
                />
                <Text style={[styles.captionCharCount, { color: theme.mutedForeground }]}>{titleDraft.length}/{AUDIO_TITLE_MAX_LENGTH}</Text>
              </>
            )}
            <TextInput
              value={captionDraft}
              onChangeText={setCaptionDraft}
              placeholder={captionTargetIndex !== null && media[captionTargetIndex]?.type.startsWith('audio/') ? 'Add a caption (optional)...' : 'Describe this photo...'}
              placeholderTextColor={theme.mutedForeground}
              multiline
              maxLength={AUDIO_CAPTION_MAX_LENGTH}
              autoFocus={captionTargetIndex !== null && !media[captionTargetIndex]?.type.startsWith('audio/')}
              style={[styles.captionInput, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background }]}
            />
            <Text style={[styles.captionCharCount, { color: theme.mutedForeground }]}>{captionDraft.length}/{AUDIO_CAPTION_MAX_LENGTH}</Text>
            <View style={styles.captionActions}>
              <Pressable
                onPress={() => {
                  if (captionTargetIndex === null) { return; }
                  const isAudioItem = media[captionTargetIndex]?.type.startsWith('audio/');
                  setMedia((prev) => {
                    return prev.map((item, i) => {
                      if (i !== captionTargetIndex) { return item; }
                      if (isAudioItem) {
                        return { ...item, caption: null, title: null };
                      }
                      return { ...item, caption: null };
                    });
                  });
                  setTitleDraft('');
                  setCaptionTargetIndex(null);
                }}
                style={[styles.captionBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.captionBtnText, { color: theme.mutedForeground }]}>Remove</Text>
              </Pressable>
              <Pressable
                onPress={saveCaptions}
                style={[styles.captionBtn, styles.captionBtnSave, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.captionBtnText, { color: theme.primaryForeground }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
  topLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  resetText: {
    fontSize: 14,
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
    minHeight: 72,
    paddingTop: 4,
  },
  featureHint: {
    marginHorizontal: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 4,
  },
  mediaStrip: {
    gap: 8,
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 2,
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
  mediaAudioCard: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingHorizontal: 6,
  },
  mediaAudioLabel: {
    color: '#FFF',
    fontSize: 9,
    textAlign: 'center',
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
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  videoNoticeBanner: {
    marginHorizontal: 0,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
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
  mediaThumbSelected: {
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  reorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reorderArrow: {
    padding: 2,
  },
  reorderArrowDisabled: {
    opacity: 0.3,
  },
  mediaCaptionBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaAddCaption: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionModal: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  captionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  captionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  captionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  captionTitleInput: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  captionCharCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: -8,
  },
  captionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  captionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  captionBtnSave: {
    borderWidth: 0,
  },
  captionBtnText: {
    fontSize: 15,
    fontWeight: '600',
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

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Re-indexes a numeric-keyed record after an item at `removedIndex` is removed.
 * Keys less than `removedIndex` are kept as-is; keys greater are decremented by 1.
 */
function reindexAfterRemoval<T>(
  record: Record<number, T>,
  removedIndex: number,
): Record<number, T> {
  const next: Record<number, T> = {};
  Object.entries(record).forEach(([k, v]) => {
    const ki = Number(k);
    if (ki < removedIndex) next[ki] = v;
    else if (ki > removedIndex) next[ki - 1] = v;
  });
  return next;
}
