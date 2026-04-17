import React, { useRef, useState, useCallback, useImperativeHandle, useEffect } from 'react';
import {
  Keyboard,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputSelectionChangeEventData,
  View,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface CodeInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
}

export interface CodeInputHandle {
  focus: () => void;
}

// Delay before clearing explicit selection to let the OS apply the cursor change
const SELECTION_APPLY_DELAY = 100;

export const CodeInput = React.forwardRef<CodeInputHandle, CodeInputProps>(
  function CodeInput({ length = 8, value, onChange, onComplete, autoFocus = false }, ref) {
    const { theme } = useTheme();
    const inputRef = useRef<TextInput>(null);
    const [focused, setFocused] = useState(false);
    const [cursorPos, setCursorPos] = useState(value.length);
    const [explicitSelection, setExplicitSelection] = useState<
      { start: number; end: number } | undefined
    >();
    const completeFiredRef = useRef(false);
    const keyboardVisibleRef = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => {
        if (!keyboardVisibleRef.current) {
          inputRef.current?.blur();
          setTimeout(() => inputRef.current?.focus(), 50);
        } else {
          inputRef.current?.focus();
        }
      },
    }));

    // Reset completeFired when value drops below full length
    useEffect(() => {
      if (value.length < length) {
        completeFiredRef.current = false;
      }
    }, [value.length, length]);

    // Track keyboard visibility so we can clear the active-cell indicator when
    // the keyboard is dismissed without a blur event (e.g. Keyboard.dismiss()).
    useEffect(() => {
      const showSub = Keyboard.addListener('keyboardDidShow', () => {
        keyboardVisibleRef.current = true;
      });
      const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        keyboardVisibleRef.current = false;
        setFocused(false);
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, []);

    // Keep cursor in bounds when value shrinks (e.g. after Clear)
    useEffect(() => {
      setCursorPos((prev) => Math.min(prev, value.length));
    }, [value.length]);

    const handleChangeText = useCallback(
      (text: string) => {
        const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, length);
        onChange(cleaned);
        if (cleaned.length === length && !completeFiredRef.current && onComplete) {
          completeFiredRef.current = true;
          Keyboard.dismiss();
          // Small delay so the last character renders before triggering lookup
          setTimeout(() => onComplete(cleaned), 150);
        }
      },
      [length, onChange, onComplete],
    );

    const handleSelectionChange = useCallback(
      (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
        setCursorPos(e.nativeEvent.selection.start);
      },
      [],
    );

    const handleCellPress = useCallback(
      (index: number) => {
        if (!keyboardVisibleRef.current) {
          // Input may still hold OS focus after Keyboard.dismiss(); blur first so
          // that the subsequent focus() call reliably reopens the keyboard.
          inputRef.current?.blur();
          setTimeout(() => inputRef.current?.focus(), 50);
        } else {
          inputRef.current?.focus();
        }
        const pos = Math.min(index, value.length);
        setCursorPos(pos);
        setExplicitSelection({ start: pos, end: pos });
        setTimeout(() => setExplicitSelection(undefined), SELECTION_APPLY_DELAY);
      },
      [value.length],
    );

    // Determine which cell should show the focus indicator
    const activeCellIndex = focused
      ? cursorPos >= value.length
        ? value.length < length
          ? value.length       // Next empty cell
          : length - 1         // All filled → last cell
        : cursorPos            // Cursor within the filled portion
      : -1;

    const cells = Array.from({ length }, (_, i) => {
      const char = value[i] || '';
      const isFilled = i < value.length;
      const isActive = i === activeCellIndex;

      let borderColor = theme.border;
      if (isActive) {
        borderColor = theme.foreground;
      } else if (isFilled) {
        borderColor = theme.accent ?? theme.border;
      }

      return (
        <Pressable
          key={i}
          onPress={() => handleCellPress(i)}
          style={[
            styles.cell,
            {
              borderColor,
              borderWidth: isActive ? 2 : 1.5,
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
            {char || (isActive ? '|' : '')}
          </Text>
        </Pressable>
      );
    });

    return (
      <View>
        <View style={styles.cellRow}>
          {cells}
        </View>
        {/* Overlay the hidden input on-screen (behind cells via pointerEvents) so the
            OS reliably opens the keyboard when focus() is called after a dismiss. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={handleChangeText}
            onSelectionChange={handleSelectionChange}
            selection={explicitSelection}
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
      </View>
    );
  },
);

const styles = StyleSheet.create({
  cellRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  cell: {
    width: 38,
    height: 48,
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
    flex: 1,
    opacity: 0,
  },
});
