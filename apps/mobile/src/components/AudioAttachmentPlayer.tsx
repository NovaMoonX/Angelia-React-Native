import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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

/**
 * Simple progress bar component that's tappable to seek
 */
function ProgressBar({
  progress,
  onSeek,
}: {
  progress: number;
  onSeek: (fraction: number) => void;
}) {
  const trackRef = useRef<View>(null);

  const handlePress = (e: any) => {
    trackRef.current?.measure((x, y, width) => {
      const { locationX } = e.nativeEvent;
      const fraction = Math.max(0, Math.min(1, locationX / width));
      onSeek(fraction);
    });
  };

  return (
    <Pressable
      ref={trackRef}
      style={styles.progressTrack}
      onPress={handlePress}
    >
      {/* Background bars (simulated waveform) */}
      <View style={styles.waveformBars}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              { height: Math.random() * 60 + 20, opacity: i / 20 < progress ? 0.6 : 0.3 },
            ]}
          />
        ))}
      </View>
      {/* Progress fill overlay */}
      <View
        style={[
          styles.progressFill,
          { width: `${Math.round(progress * 100)}%` },
        ]}
      />
    </Pressable>
  );
}

export function AudioAttachmentPlayer({ uri, variant = 'compact' }: AudioAttachmentPlayerProps) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  // Safely clean up player on unmount
  useEffect(() => {
    return () => {
      try {
        player.release();
      } catch {
        // Silently ignore cleanup errors
      }
    };
  }, [player]);

  const progress = useMemo(() => {
    const duration = status.duration > 0 ? status.duration : 0;
    if (duration <= 0) return 0;
    return Math.max(0, Math.min(1, status.currentTime / duration));
  }, [status.currentTime, status.duration]);

  const togglePlayback = async () => {
    try {
      if (status.playing) {
        await player.pause();
      } else {
        await player.play();
      }
    } catch {
      // Silently ignore playback errors
    }
  };

  const handleSeek = async (fraction: number) => {
    try {
      const newTime = fraction * (status.duration || 0);
      if (Number.isFinite(newTime)) {
        await player.seekTo(newTime);
      }
    } catch {
      // Silently ignore seek errors
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

      <ProgressBar progress={progress} onSeek={handleSeek} />
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
  progressTrack: {
    width: '100%',
    height: 48,
    borderRadius: 3,
    backgroundColor: '#1F2937',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformBars: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
    gap: 1,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 1,
    backgroundColor: '#4B5563',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    backgroundColor: '#E24B4A',
    opacity: 0.6,
  },
});
