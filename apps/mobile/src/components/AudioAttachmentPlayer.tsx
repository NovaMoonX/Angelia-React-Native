import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Waveform } from '@simform_solutions/react-native-audio-waveform';
import type { IWaveformRef } from '@simform_solutions/react-native-audio-waveform';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

interface AudioAttachmentPlayerProps {
  uri: string;
  variant?: 'compact' | 'full';
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function AudioAttachmentPlayer({ uri, variant = 'compact' }: AudioAttachmentPlayerProps) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const waveformRef = useRef<IWaveformRef>(null);

  useEffect(() => {
    return () => {
      player.remove();
    };
  }, [player]);

  const progress = useMemo(() => {
    const duration = status.duration > 0 ? status.duration : 0;
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(1, status.currentTime / duration));
  }, [status.currentTime, status.duration]);

  const isLocalFile = uri.startsWith('file://');

  const togglePlayback = async () => {
    if (status.playing) {
      player.pause();
      if (isLocalFile) {
        await waveformRef.current?.pausePlayer().catch(() => {
          return false;
        });
      }
      return;
    }

    player.play();
    if (isLocalFile) {
      await waveformRef.current?.startPlayer().catch(() => {
        return false;
      });
    }
  };

  return (
    <View style={[styles.card, variant === 'full' ? styles.cardFull : styles.cardCompact]}>
      <View style={styles.topRow}>
        <Pressable onPress={() => { void togglePlayback(); }} hitSlop={8} style={styles.playButton}>
          <Feather name={status.playing ? 'pause' : 'play'} size={18} color="#FFF" />
        </Pressable>
        <View style={styles.textBlock}>
          <Text style={styles.title}>Audio clip</Text>
          <Text style={styles.timeText}>
            {formatDuration(status.currentTime)} / {formatDuration(status.duration)}
          </Text>
        </View>
      </View>

      {isLocalFile ? (
        <Waveform
          ref={waveformRef}
          mode="static"
          path={uri}
          waveColor="#9CA3AF"
          scrubColor="#E24B4A"
          candleSpace={2}
          candleWidth={3}
          containerStyle={styles.waveform}
        />
      ) : (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  cardCompact: {
    minHeight: 84,
  },
  cardFull: {
    minHeight: 120,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '700',
  },
  timeText: {
    color: '#D1D5DB',
    fontSize: 12,
    marginTop: 2,
  },
  waveform: {
    width: '100%',
    height: 48,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#374151',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E24B4A',
  },
});
