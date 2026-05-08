import React from 'react';
import { TextInput, StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface TextareaProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  style?: ViewStyle;
}

export function Textarea({
  value,
  onChangeText,
  placeholder,
  rows = 3,
  maxLength,
  style,
}: TextareaProps) {
  const { theme } = useTheme();

  return (
    <View style={style}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.mutedForeground}
        multiline
        numberOfLines={rows}
        maxLength={maxLength}
        textAlignVertical="top"
        style={[
          styles.textarea,
          {
            color: theme.foreground,
            backgroundColor: theme.background,
            borderColor: theme.border,
            minHeight: rows * 24 + 20,
          },
        ]}
      />
      {maxLength && (
        <Text style={[styles.charCount, { color: theme.mutedForeground }]}>
          {value.length}/{maxLength}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
});
