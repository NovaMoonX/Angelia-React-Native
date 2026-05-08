import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface SeparatorProps {
  style?: ViewStyle;
}

export function Separator({ style }: SeparatorProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.separator, { backgroundColor: theme.border }, style]} />
  );
}

const styles = StyleSheet.create({
  separator: {
    height: 1,
    width: '100%',
    marginVertical: 16,
  },
});
