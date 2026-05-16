import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { AudioAttachmentPlayer } from '@/components/AudioAttachmentPlayer';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { MAX_FILES } from '@/models/constants';
import { KEYBOARD_BEHAVIOR } from '@/constants/layout';
import type { MediaFile } from '@/components/PostCreateMediaUploader';

const MAX_RECORDING_SECONDS = 180;
const COUNTDOWN_WARNING_SECONDS = 15;
const AUDIO_TITLE_MAX = 60;
const AUDIO_CAPTION_MAX = 300;

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

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function AudioRecordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { addToast } = useToast();

  const params = useLocalSearchParams<{
    editPostId?: string;
    existingMedia?: string;
    existingText?: string;
    existingChannel?: string;
    existingTier?: string;
    existingPendingStatus?: string;
  }>();

  const existingFiles = useMemo<MediaFile[]>(() => {
    if (!params.existingMedia) {
      return [];
    }
    try {
      return decodeMediaParam(params.existingMedia);
    } catch {
      return [];
    }
  }, [params.existingMedia]);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  const [permissionReady, setPermissionReady] = useState<boolean | null>(null);
  const [recordedClips, setRecordedClips] = useState<MediaFile[]>([]);
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);
  const autoStopTriggeredRef = useRef(false);

  const slotsRemaining = Math.max(0, MAX_FILES - (existingFiles.length + recordedClips.length));
  const currentDurationSeconds = Math.floor((recorderState.durationMillis ?? 0) / 1000);
  const remainingSeconds = Math.max(0, MAX_RECORDING_SECONDS - currentDurationSeconds);
  const isInCountdownWindow = recorderState.isRecording && remainingSeconds <= COUNTDOWN_WARNING_SECONDS;

  const totalRecordedSeconds = useMemo(() => {
    return recordedClips.reduce((total, clip) => {
      const seconds = Number(clip.durationSeconds ?? 0);
      return total + (Number.isFinite(seconds) ? seconds : 0);
    }, 0);
  }, [recordedClips]);

  const selectedClip = selectedClipIndex !== null ? recordedClips[selectedClipIndex] ?? null : null;
  const selectedClipDefaultTitle = selectedClipIndex !== null ? `Recording ${selectedClipIndex + 1}` : 'Recording';

  const mergedMedia = useMemo(() => {
    return [...existingFiles, ...recordedClips].slice(0, MAX_FILES);
  }, [existingFiles, recordedClips]);

  const returnToComposer = (capturedMedia: MediaFile[]) => {
    router.replace({
      pathname: '/(protected)/post/new',
      params: {
        editPostId: params.editPostId,
        capturedMedia: encodeMediaParam(capturedMedia),
        existingText: params.existingText,
        existingChannel: params.existingChannel,
        existingTier: params.existingTier,
        existingPendingStatus: params.existingPendingStatus,
      },
    });
  };

  useEffect(() => {
    void getRecordingPermissionsAsync()
      .then((permission) => {
        setPermissionReady(permission.granted);
      })
      .catch(() => {
        setPermissionReady(false);
      });
  }, []);

  const handleRequestPermission = async (): Promise<boolean> => {
    const result = await requestRecordingPermissionsAsync();
    setPermissionReady(result.granted);
    if (!result.granted) {
      addToast({ type: 'warning', title: 'Microphone permission is required to record audio' });
      return false;
    }
    return true;
  };

  const handleStartRecording = async () => {
    const hasPermission = permissionReady === true ? true : await handleRequestPermission();
    if (!hasPermission) {
      return;
    }
    if (slotsRemaining <= 0) {
      addToast({ type: 'warning', title: `Maximum ${MAX_FILES} files already attached` });
      return;
    }

    try {
      autoStopTriggeredRef.current = false;
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      addToast({ type: 'error', title: 'Could not start recording' });
    }
  };

  const handleStopRecording = async (showLimitToast: boolean) => {
    try {
      await recorder.stop();
      const status = recorder.getStatus();
      const nextUri = status.url ?? recorder.uri;
      if (!nextUri) {
        addToast({ type: 'error', title: 'Recording failed. Please try again.' });
        return;
      }
      const nextDuration = Math.max(1, Math.min(MAX_RECORDING_SECONDS, currentDurationSeconds));
      const nextClip: MediaFile = {
        uri: nextUri,
        name: `recording-${Date.now()}.m4a`,
        type: 'audio/m4a',
        title: null,
        caption: null,
        durationSeconds: nextDuration,
      };

      setRecordedClips((prev) => {
        const next = [...prev, nextClip].slice(0, MAX_FILES - existingFiles.length);
        const nextSelectedIndex = next.length - 1;
        setSelectedClipIndex(nextSelectedIndex >= 0 ? nextSelectedIndex : null);
        return next;
      });

      if (showLimitToast) {
        addToast({ type: 'info', title: 'Recording capped at 3 minutes ⏱️' });
      }
    } catch {
      addToast({ type: 'error', title: 'Could not stop recording' });
    }
  };

  const handleApplyRecordings = async () => {
    if (recorderState.isRecording) {
      await handleStopRecording(false);
    }
    returnToComposer(mergedMedia);
  };

  const handleCloseScreen = async () => {
    if (recorderState.isRecording) {
      await handleStopRecording(false);
    }
    returnToComposer(mergedMedia);
  };

  const handleRemoveClip = (index: number) => {
    setRecordedClips((prev) => {
      const next = prev.filter((_, i) => {
        return i !== index;
      });
      if (next.length === 0) {
        setSelectedClipIndex(null);
        return next;
      }
      const targetIndex = selectedClipIndex === null
        ? 0
        : selectedClipIndex > index
          ? selectedClipIndex - 1
          : Math.min(selectedClipIndex, next.length - 1);
      setSelectedClipIndex(targetIndex);
      return next;
    });
  };

  const updateSelectedClip = (partial: Pick<MediaFile, 'title' | 'caption'>) => {
    if (selectedClipIndex === null) {
      return;
    }
    setRecordedClips((prev) => {
      return prev.map((clip, index) => {
        if (index !== selectedClipIndex) {
          return clip;
        }
        return {
          ...clip,
          ...partial,
        };
      });
    });
  };

  useEffect(() => {
    if (!recorderState.isRecording) {
      return;
    }
    if (currentDurationSeconds < MAX_RECORDING_SECONDS) {
      return;
    }
    if (autoStopTriggeredRef.current) {
      return;
    }
    autoStopTriggeredRef.current = true;
    void handleStopRecording(true);
  }, [currentDurationSeconds, recorderState.isRecording]);

  useEffect(() => {
    if (recordedClips.length === 0) {
      if (selectedClipIndex !== null) {
        setSelectedClipIndex(null);
      }
      return;
    }
    if (selectedClipIndex === null) {
      setSelectedClipIndex(recordedClips.length - 1);
      return;
    }
    if (selectedClipIndex >= recordedClips.length) {
      setSelectedClipIndex(recordedClips.length - 1);
    }
  }, [recordedClips, selectedClipIndex]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={KEYBOARD_BEHAVIOR}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}> 
        <Pressable onPress={() => { void handleCloseScreen(); }} hitSlop={10}>
          <Feather name="x" size={24} color={theme.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: theme.foreground }]}>Record Audio</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps='handled'
      >
        <View style={[styles.timerCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.timerLabel, { color: theme.mutedForeground }]}>Current Recording</Text>
          <Text style={[styles.timerValue, { color: theme.foreground }]}>{formatSeconds(currentDurationSeconds)}</Text>
          <Text style={[styles.metaText, { color: theme.mutedForeground }]}>
            {slotsRemaining} slot{slotsRemaining === 1 ? '' : 's'} left • {recordedClips.length} new clip{recordedClips.length === 1 ? '' : 's'} • {formatSeconds(totalRecordedSeconds)} total
          </Text>
          <Text style={[styles.timerHint, { color: theme.mutedForeground }]}> 
            {recorderState.isRecording
              ? 'Recording in progress... each clip can be up to 3 minutes.'
              : slotsRemaining > 0
                ? 'Tap Start to add another clip, then title and caption it below.'
                : `You reached the ${MAX_FILES}-file attachment limit.`}
          </Text>
          {isInCountdownWindow && (
            <Text style={styles.countdownText}>{remainingSeconds}s left</Text>
          )}
        </View>

        {!recorderState.isRecording && (
          <Pressable
            style={[styles.primaryButton, { backgroundColor: slotsRemaining > 0 ? theme.primary : theme.muted }]}
            onPress={() => { void handleStartRecording(); }}
            disabled={slotsRemaining <= 0}
          >
            <Feather name="mic" size={18} color={slotsRemaining > 0 ? theme.primaryForeground : theme.mutedForeground} />
            <Text style={[styles.primaryButtonText, { color: slotsRemaining > 0 ? theme.primaryForeground : theme.mutedForeground }]}>Start Recording</Text>
          </Pressable>
        )}

        {recorderState.isRecording && (
          <Pressable
            style={[styles.stopButton, { backgroundColor: '#DC2626' }]}
            onPress={() => { void handleStopRecording(false); }}
          >
            <Feather name="square" size={16} color="#FFF" />
            <Text style={styles.stopButtonText}>Stop Recording</Text>
          </Pressable>
        )}

        {recordedClips.length > 0 && (
          <View style={[styles.clipListCard, { borderColor: theme.border, backgroundColor: theme.card }]}> 
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>New Recordings</Text>
            {recordedClips.map((clip, index) => {
              const isSelected = selectedClipIndex === index;
              const clipLabel = clip.title?.trim() || `Recording ${index + 1}`;
              const clipDurationSeconds = Number(clip.durationSeconds ?? 0);
              return (
                <Pressable
                  key={clip.name}
                  onPress={() => setSelectedClipIndex(index)}
                  style={[
                    styles.clipRow,
                    { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.background : theme.card },
                  ]}
                >
                  <View style={styles.clipRowLeft}>
                    <Feather name='music' size={14} color={theme.mutedForeground} />
                    <View style={styles.clipTextWrap}>
                      <Text style={[styles.clipTitle, { color: theme.foreground }]} numberOfLines={1}>{clipLabel}</Text>
                      <Text style={[styles.clipMeta, { color: theme.mutedForeground }]}>{formatSeconds(clipDurationSeconds)}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => handleRemoveClip(index)} hitSlop={8}>
                    <Feather name='trash-2' size={15} color='#EF4444' />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}

        {selectedClip && (
          <View style={[styles.editorCard, { borderColor: theme.border, backgroundColor: theme.card }]}> 
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Preview & Details</Text>
            <AudioAttachmentPlayer uri={selectedClip.uri} title={selectedClip.title?.trim() || selectedClipDefaultTitle} />
            <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>{`Title (${selectedClipDefaultTitle})`}</Text>
            <TextInput
              value={selectedClip.title ?? ''}
              onChangeText={(next) => {
                updateSelectedClip({ title: next.slice(0, AUDIO_TITLE_MAX) || null, caption: selectedClip.caption ?? null });
              }}
              placeholder='Give this clip a quick title'
              placeholderTextColor={theme.mutedForeground}
              style={[styles.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background }]}
              maxLength={AUDIO_TITLE_MAX}
            />
            <Text style={[styles.charCount, { color: theme.mutedForeground }]}>{(selectedClip.title ?? '').length}/{AUDIO_TITLE_MAX}</Text>

            <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Caption</Text>
            <TextInput
              value={selectedClip.caption ?? ''}
              onChangeText={(next) => {
                updateSelectedClip({ title: selectedClip.title ?? null, caption: next.slice(0, AUDIO_CAPTION_MAX) || null });
              }}
              placeholder='Add context for this recording'
              placeholderTextColor={theme.mutedForeground}
              style={[styles.input, styles.captionInput, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background }]}
              multiline
              textAlignVertical='top'
              maxLength={AUDIO_CAPTION_MAX}
            />
            <Text style={[styles.charCount, { color: theme.mutedForeground }]}>{(selectedClip.caption ?? '').length}/{AUDIO_CAPTION_MAX}</Text>
          </View>
        )}

      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, paddingBottom: insets.bottom + 10 }]}> 
        <Pressable style={[styles.secondaryButton, { borderColor: theme.border }]} onPress={() => { void handleCloseScreen(); }}>
          <Text style={[styles.secondaryButtonText, { color: theme.foreground }]}>Back</Text>
        </Pressable>
        <Pressable style={[styles.primaryButton, styles.useButton, { backgroundColor: theme.primary }]} onPress={() => { void handleApplyRecordings(); }}>
          <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Use {recordedClips.length} Recording{recordedClips.length === 1 ? '' : 's'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 24,
    height: 24,
  },
  content: {
    padding: 20,
    gap: 14,
  },
  timerCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  timerValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  timerHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  countdownText: {
    color: '#DC2626',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
  },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  stopButton: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stopButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  useButton: {
    flex: 1,
  },
  clipListCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  clipRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clipRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  clipTextWrap: {
    flex: 1,
  },
  clipTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  clipMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  editorCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  captionInput: {
    minHeight: 86,
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: -2,
  },
});
