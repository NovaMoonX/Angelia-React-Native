import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { AvatarPreset } from '@/models/types';

interface AvatarProps {
  preset: AvatarPreset;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  style?: ViewStyle;
  /** When provided, renders a small emoji badge at the bottom-right of the avatar. */
  statusEmoji?: string;
  /** Firebase Storage download URL for a custom profile photo. When set, renders the photo instead of the preset emoji. */
  uri?: string;
}

const SIZE_MAP = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
};

const BADGE_SCALE = 0.45;

const PRESET_EMOJIS: Record<AvatarPreset, string> = {
  astronaut: '🧑‍🚀',
  moon: '🌙',
  star: '⭐',
  galaxy: '🌌',
  nebula: '🔮',
  planet: '🪐',
  'cosmic-cat': '🐱',
  'dream-cloud': '☁️',
  rocket: '🚀',
  constellation: '✨',
  comet: '☄️',
  twilight: '🌅',
  aurora: '🌈',
  supernova: '💥',
  'lunar-moth': '🦋',
  satellite: '🛰️',
  alien: '👽',
  'black-hole': '🕳️',
};

const PRESET_COLORS: Record<AvatarPreset, string> = {
  astronaut: '#6366F1',
  moon: '#1E3A5F',       // deep navy — no conflict with crescent emoji
  star: '#F59E0B',
  galaxy: '#8B5CF6',
  nebula: '#A855F7',
  planet: '#3B82F6',
  'cosmic-cat': '#EC4899',
  'dream-cloud': '#06B6D4',
  rocket: '#EF4444',
  constellation: '#10B981',
  comet: '#F97316',
  twilight: '#F43F5E',
  aurora: '#059669',
  supernova: '#DC2626',
  'lunar-moth': '#7C3AED',
  satellite: '#0EA5E9',
  alien: '#22C55E',
  'black-hole': '#18181B',
};

export function Avatar({ preset, size = 'md', shape = 'circle', style, statusEmoji, uri }: AvatarProps) {
  const dimension = SIZE_MAP[size];
  const borderRadius = shape === 'circle' ? dimension / 2 : 8;
  const fontSize = dimension * 0.5;
  const badgeSize = Math.round(dimension * BADGE_SCALE);
  const badgeFontSize = Math.round(badgeSize * 0.7);

  return (
    <View style={[{ width: dimension, height: dimension }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.container, { width: dimension, height: dimension, borderRadius }]}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.container,
            {
              width: dimension,
              height: dimension,
              borderRadius,
              backgroundColor: PRESET_COLORS[preset] || '#6366F1',
            },
          ]}
        >
          <Text style={{ fontSize }}>{PRESET_EMOJIS[preset] || '🌙'}</Text>
        </View>
      )}
      {statusEmoji ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
          ]}
        >
          <Text style={{ fontSize: badgeFontSize, lineHeight: badgeSize }}>{statusEmoji}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
