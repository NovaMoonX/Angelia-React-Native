import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface BellIconProps {
  hasNotification?: boolean;
  hasReleaseNotice?: boolean;
  releaseNoticeColor?: string;
}

export function BellIcon({
  hasNotification = false,
  hasReleaseNotice = false,
  releaseNoticeColor = '#0EA5E9',
}: BellIconProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Feather name="bell" size={24} color={theme.foreground} />
      {hasNotification && <View style={styles.dot} />}
      {hasReleaseNotice && (
        <View
          style={[
            styles.releaseDot,
            { backgroundColor: releaseNoticeColor },
          ]}
        />
      )}
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
  releaseDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
