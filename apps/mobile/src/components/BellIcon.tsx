import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface BellIconProps {
  hasNotification?: boolean;
}

export function BellIcon({ hasNotification = false }: BellIconProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Feather name="bell" size={24} color={theme.foreground} />
      {hasNotification && <View style={styles.dot} />}
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
