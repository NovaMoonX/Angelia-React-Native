import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Toggle } from '@/components/ui/Toggle';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { resolvedTheme, theme, toggleTheme } = useTheme();

  return (
    <View style={styles.container}>
      <Feather
        name={resolvedTheme === 'dark' ? 'moon' : 'sun'}
        size={18}
        color={theme.foreground}
        style={styles.icon}
      />
      <Toggle checked={resolvedTheme === 'dark'} onToggle={toggleTheme} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    marginRight: 4,
  },
});
