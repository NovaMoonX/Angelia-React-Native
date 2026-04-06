import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  shape?: 'circle' | 'square';
  style?: ViewStyle;
}

export function Skeleton({ width, height = 16, borderRadius, shape, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const { theme } = useTheme();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const computedBorderRadius =
    shape === 'circle' ? (typeof height === 'number' ? height / 2 : 50) : borderRadius ?? 4;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width ?? '100%',
          height,
          borderRadius: computedBorderRadius,
          backgroundColor: theme.muted,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {},
});
