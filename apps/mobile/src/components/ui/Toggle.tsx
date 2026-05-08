import React from 'react';
import { Switch } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ToggleProps {
  checked: boolean;
  onToggle: () => void;
}

export function Toggle({ checked, onToggle }: ToggleProps) {
  const { theme } = useTheme();

  return (
    <Switch
      value={checked}
      onValueChange={onToggle}
      trackColor={{ false: theme.muted, true: theme.primary }}
      thumbColor="#FFFFFF"
    />
  );
}
