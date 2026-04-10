import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

interface CalloutProps {
  variant: 'info' | 'success' | 'destructive' | 'warning';
  title?: string;
  description: React.ReactNode;
  icon?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  style?: ViewStyle;
}

const VARIANT_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  info: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
  success: { bg: '#F0FFF4', border: '#16A34A', text: '#166534' },
  destructive: { bg: '#FEF2F2', border: '#DC2626', text: '#991B1B' },
  warning: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
};

export function Callout({
  variant,
  title,
  description,
  icon,
  dismissible = false,
  onDismiss,
  style,
}: CalloutProps) {
  const colors = VARIANT_STYLES[variant];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.content}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <View style={styles.textContainer}>
          {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
          {typeof description === 'string' ? (
            <Text style={[styles.description, { color: colors.text }]}>{description}</Text>
          ) : (
            description
          )}
        </View>
        {dismissible && (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Text style={[styles.dismiss, { color: colors.text }]}>✕</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  dismiss: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
