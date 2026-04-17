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
    (_e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      // Default TextInput behavior handles backspace
    },
    [],
  );

  const handlePress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const allFilled = value.length === length;

  const cells = Array.from({ length }, (_, i) => {
    const char = value[i] || '';
    const isFilled = i < value.length;
    // Show cursor on the next empty cell, or highlight the last cell when all filled
    const isCursorCell = focused && i === value.length && !allFilled;
    const isActiveLastCell = focused && allFilled && i === length - 1;

    let borderColor = theme.border;
    if (isCursorCell || isActiveLastCell) {
      borderColor = theme.primary;
    } else if (isFilled) {
      borderColor = theme.accent ?? theme.border;
    }

    return (
      <View
        key={i}
        style={[
          styles.cell,
          {
            borderColor,
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
          {char || (isCursorCell ? '|' : '')}
        </Text>
      </View>
    );
  });

  return (
    <View>
      <Pressable style={styles.cellRow} onPress={handlePress}>
        {cells}
      </Pressable>
      {/* Off-screen but non-zero-size so iOS/Android re-open the keyboard on focus() */}
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
  // Position off-screen with a non-zero size so the OS treats it as focusable
  // and re-opens the keyboard when focus() is called after keyboard dismiss.
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -9999,
    left: -9999,
  },
});
