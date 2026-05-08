import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface HelpIconProps {
  message: string;
}

export function HelpIcon({ message }: HelpIconProps) {
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setVisible(!visible)} hitSlop={8}>
        <Text style={[styles.icon, { color: theme.mutedForeground }]}>ⓘ</Text>
      </Pressable>
      {visible && (
        <View style={[styles.tooltip, { backgroundColor: theme.tooltip }]}>
          <Text style={[styles.tooltipText, { color: theme.tooltipForeground }]}>
            {message}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  icon: {
    fontSize: 16,
  },
  tooltip: {
    position: 'absolute',
    top: -8,
    left: 24,
    padding: 8,
    borderRadius: 6,
    maxWidth: 200,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltipText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
