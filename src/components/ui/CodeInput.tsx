import React, { useRef, useState, useCallback } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface CodeInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  autoFocus?: boolean;
}

export function CodeInput({
  length = 8,
  value,
  onChange,
  autoFocus = false,
}: CodeInputProps) {
  const { theme } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const handleChangeText = useCallback(
    (text: string) => {
      // Strip non-alphanumeric and uppercase
      const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, length);
      onChange(cleaned);
    },
    [length, onChange],
  );

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (e.nativeEvent.key === 'Backspace' && value.length > 0) {
        // Default TextInput behavior handles this
      }
    },
    [value],
  );

  const handlePress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const cells = Array.from({ length }, (_, i) => {
    const char = value[i] || '';
    const isCursor = focused && i === value.length;
    const isFilled = i < value.length;

    return (
      <View
        key={i}
        style={[
          styles.cell,
          {
            borderColor: isCursor
              ? theme.primary
              : isFilled
                ? theme.accent
                : theme.border,
            backgroundColor: isFilled ? theme.secondary : theme.background,
          },
        ]}
      >
        <Text
          style={[
            styles.cellText,
            {
              color: isFilled ? theme.foreground : theme.mutedForeground,
            },
          ]}
        >
          {char || (isCursor ? '|' : '')}
        </Text>
      </View>
    );
  });

  return (
    <View>
      <Pressable style={styles.cellRow} onPress={handlePress}>
        {cells}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        maxLength={length}
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'visible-password'}
        style={styles.hiddenInput}
        caretHidden
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cellRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  cell: {
    width: 38,
    height: 48,
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
});
