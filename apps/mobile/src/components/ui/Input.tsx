import React from 'react';
import { TextInput, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: TextInputProps['keyboardType'];
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  onSubmitEditing?: () => void;
  style?: ViewStyle;
  editable?: boolean;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  maxLength,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  autoComplete,
  onSubmitEditing,
  style,
  editable = true,
}: InputProps) {
  const { theme } = useTheme();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.mutedForeground}
      maxLength={maxLength}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      onSubmitEditing={onSubmitEditing}
      editable={editable}
      style={[
        styles.input,
        {
          color: theme.foreground,
          backgroundColor: theme.background,
          borderColor: theme.border,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
