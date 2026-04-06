import React from 'react';
import { Text, StyleSheet, type TextStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface LabelProps {
  children: React.ReactNode;
  style?: TextStyle;
}

export function Label({ children, style }: LabelProps) {
  const { theme } = useTheme();

  return (
    <Text style={[styles.label, { color: theme.foreground }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
});
