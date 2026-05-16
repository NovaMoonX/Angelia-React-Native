import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

interface AudioAttachmentPlayerProps {
  uri: string;
  variant?: 'compact' | 'full';
  title?: string | null;
  isActive?: boolean;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function buildWaveHeights(seedSource: string, count = 44): number[] {
  let seed = 0;
  for (let i = 0; i < seedSource.length; i += 1) {
    seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0;
  }

  const bars: number[] = [];
  for (let i = 0; i < count; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const normalized = (seed & 0xffff) / 0xffff;
    // Keep amplitudes smooth while favoring taller bars.
    bars.push(0.38 + normalized * 0.82);
  }
  return bars;
}

/**
 * Simple progress bar component that's tappable to seek
 */
function ProgressBar({
  progress,
  onSeek,
  waveHeights,
}: {
  progress: number;
  onSeek: (fraction: number) => void;
  waveHeights: number[];
}) {
  const trackWidthRef = useRef<number>(0);

  const handleLayout = (e: any) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  };

  const handlePress = (e: any) => {
    const width = trackWidthRef.current;
    const { locationX } = e.nativeEvent;
    if (width <= 0) { return; }
    const fraction = Math.max(0, Math.min(1, locationX / width));
    onSeek(fraction);
  };

  return (
    <Pressable
      style={styles.progressTrack}
      onLayout={handleLayout}
      onPress={handlePress}
    >
      {/* pointerEvents="none" prevents child views from stealing locationX */}
      <View style={styles.waveformBars} pointerEvents="none">
        {waveHeights.map((heightFactor, i) => (
          <View
            key={i}
            style={[
              styles.waveformBar,
              {
                height: 12 + heightFactor * 40,
                backgroundColor: (i + 1) / waveHeights.length <= progress ? '#FB923C' : '#4B5563',
                opacity: (i + 1) / waveHeights.length <= progress ? 0.95 : 0.45,
              },
            ]}
          />
        ))}
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.playhead,
          { left: `${Math.round(progress * 100)}%` },
        ]}
      />
    </Pressable>
  );
}

export function AudioAttachmentPlayer({ uri, variant = 'compact', title, isActive = true }: AudioAttachmentPlayerProps) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const waveHeights = useMemo(() => {
    return buildWaveHeights(uri);
  }, [uri]);

  // Pause playback if this audio card is no longer the active carousel item.
  useEffect(() => {
    if (isActive) {
      return;
    }
    if (!status.playing) {
      return;
    }
    try {
      player.pause();
    } catch {
      // Silently ignore pause errors while carousel items change.
    }
  }, [isActive, status.playing, player]);

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
        const hasDuration = Number.isFinite(status.duration) && status.duration > 0;
        const atTrackEnd = hasDuration && status.currentTime >= status.duration - 0.05;
        if (atTrackEnd) {
          await player.seekTo(0);
        }
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
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title?.trim() || 'Audio clip'}</Text>
          <Text style={styles.timeText}>
            {formatDuration(status.currentTime)} / {formatDuration(status.duration)}
          </Text>
        </View>
        <Pressable onPress={() => { void togglePlayback(); }} hitSlop={8} style={styles.playButton}>
          <Feather name={status.playing ? 'pause' : 'play'} size={18} color="#FFF" />
        </Pressable>
      </View>

      <ProgressBar progress={progress} onSeek={handleSeek} waveHeights={waveHeights} />
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
    minHeight: 96,
  },
  cardFull: {
    minHeight: 136,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
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
    height: 72,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A3447',
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
    borderRadius: 999,
  },
  playhead: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 2,
    marginLeft: -1,
    borderRadius: 999,
    backgroundColor: '#FDBA74',
  },
});
