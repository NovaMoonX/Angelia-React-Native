import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import type { AvatarPreset } from '@/models/types';

interface AvatarProps {
  preset: AvatarPreset;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  style?: ViewStyle;
}

const SIZE_MAP = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
};

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
};

const PRESET_COLORS: Record<AvatarPreset, string> = {
  astronaut: '#6366F1',
  moon: '#FBBF24',
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
};

export function Avatar({ preset, size = 'md', shape = 'circle', style }: AvatarProps) {
  const dimension = SIZE_MAP[size];
  const borderRadius = shape === 'circle' ? dimension / 2 : 8;
  const fontSize = dimension * 0.5;

  return (
    <View
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius,
          backgroundColor: PRESET_COLORS[preset] || '#6366F1',
        },
        style,
      ]}
    >
      <Text style={{ fontSize }}>{PRESET_EMOJIS[preset] || '🌙'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
