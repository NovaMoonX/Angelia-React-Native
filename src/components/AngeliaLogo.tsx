import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface AngeliaLogoProps {
  size?: number;
}

export function AngeliaLogo({ size = 32 }: AngeliaLogoProps) {
  const { theme } = useTheme();

  return (
    <Text style={[styles.logo, { fontSize: size, color: theme.primary }]}>
      🏠
    </Text>
  );
}

const styles = StyleSheet.create({
  logo: {
    textAlign: 'center',
  },
});
