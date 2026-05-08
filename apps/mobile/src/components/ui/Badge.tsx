import React from 'react';
import { Text, View, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

interface BadgeProps {
  variant?: 'base' | 'secondary';
  style?: ViewStyle;
  textStyle?: TextStyle;
  children: React.ReactNode;
}

export function Badge({ variant = 'base', style, textStyle, children }: BadgeProps) {
  return (
    <View style={[styles.badge, variant === 'secondary' && styles.secondary, style]}>
      <Text style={[styles.text, variant === 'secondary' && styles.secondaryText, textStyle]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#D97706',
    borderWidth: 1,
    borderColor: '#D97706',
    alignSelf: 'flex-start',
  },
  secondary: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FEF3C7',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#78350F',
  },
});
