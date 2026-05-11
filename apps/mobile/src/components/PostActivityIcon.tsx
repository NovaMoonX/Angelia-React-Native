import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface PostActivityIconProps {
  hasNotification?: boolean;
}

export function PostActivityIcon({ hasNotification = false }: PostActivityIconProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Feather name='clock' size={24} color={theme.foreground} />
      {hasNotification ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
});
