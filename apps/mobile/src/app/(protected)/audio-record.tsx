import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { MAX_FILES } from '@/models/constants';
import type { MediaFile } from '@/components/PostCreateMediaUploader';

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
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  const returnToComposer = () => {
    router.replace({
      pathname: '/(protected)/post/new',
      params: {
        editPostId: params.editPostId,
        capturedMedia: encodeMediaParam(existingFiles),
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

    try {
      setRecordedUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      addToast({ type: 'error', title: 'Could not start recording' });
    }
  };

  const handleStopRecording = async () => {
    try {
      await recorder.stop();
      const status = recorder.getStatus();
      const nextUri = status.url ?? recorder.uri;
      if (!nextUri) {
        addToast({ type: 'error', title: 'Recording failed. Please try again.' });
        return;
      }
      setRecordedUri(nextUri);
    } catch {
      addToast({ type: 'error', title: 'Could not stop recording' });
    }
  };

  const handleUseRecording = () => {
    if (!recordedUri) {
      return;
    }
    if (existingFiles.length >= MAX_FILES) {
      addToast({ type: 'warning', title: `Maximum ${MAX_FILES} files already attached` });
      returnToComposer();
      return;
    }

    const recordedFile: MediaFile = {
      uri: recordedUri,
      name: `recording-${Date.now()}.m4a`,
      type: 'audio/m4a',
      caption: null,
    };

    const merged = [...existingFiles, recordedFile].slice(0, MAX_FILES);

    router.replace({
      pathname: '/(protected)/post/new',
      params: {
        editPostId: params.editPostId,
        capturedMedia: encodeMediaParam(merged),
        existingText: params.existingText,
        existingChannel: params.existingChannel,
        existingTier: params.existingTier,
        existingPendingStatus: params.existingPendingStatus,
      },
    });
  };

  const handleRecordAgain = () => {
    setRecordedUri(null);
  };

  const durationSeconds = Math.floor((recorderState.durationMillis ?? 0) / 1000);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}> 
        <Pressable onPress={returnToComposer} hitSlop={10}>
          <Feather name="x" size={24} color={theme.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: theme.foreground }]}>Record Audio</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}> 
        <View style={[styles.timerCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <Text style={[styles.timerLabel, { color: theme.mutedForeground }]}>Recording Time</Text>
          <Text style={[styles.timerValue, { color: theme.foreground }]}>{formatSeconds(durationSeconds)}</Text>
          <Text style={[styles.timerHint, { color: theme.mutedForeground }]}> 
            {recorderState.isRecording
              ? 'Recording in progress... tap Stop when you are done.'
              : recordedUri
                ? 'Recording ready. Use it in your post or record again.'
                : 'Tap Start to record audio in-app.'}
          </Text>
        </View>

        {!recorderState.isRecording && recordedUri == null && (
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={handleStartRecording}
          >
            <Feather name="mic" size={18} color={theme.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Start Recording</Text>
          </Pressable>
        )}

        {recorderState.isRecording && (
          <Pressable
            style={[styles.stopButton, { backgroundColor: '#DC2626' }]}
            onPress={handleStopRecording}
          >
            <Feather name="square" size={16} color="#FFF" />
            <Text style={styles.stopButtonText}>Stop Recording</Text>
          </Pressable>
        )}

        {!recorderState.isRecording && recordedUri != null && (
          <View style={styles.actionsRow}> 
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={handleRecordAgain}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.foreground }]}>Record Again</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, styles.useButton, { backgroundColor: theme.primary }]}
              onPress={handleUseRecording}
            >
              <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Use Recording</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
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
    flex: 1,
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
  actionsRow: {
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
});
