import React, { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { EmojiPicker } from '@/components/EmojiPicker';
import { KEYBOARD_BEHAVIOR } from '@/constants/layout';
import type { UserStatus } from '@/models/types';

interface NowStatusModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (status: UserStatus) => void;
  onClear: () => void;
  currentStatus: UserStatus | null | undefined;
}

const DURATION_OPTIONS = [
  { label: '30 minutes', ms: 30 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '4 hours', ms: 4 * 60 * 60 * 1000 },
  { label: '8 hours', ms: 8 * 60 * 60 * 1000 },
  { label: 'Today', ms: 0 },         // calculated at save time
  { label: 'Custom', ms: -1 },       // shows date-time inputs
];

const SUGGESTIONS = [
  { emoji: '💼', text: 'At work' },
  { emoji: '🎉', text: 'Big win today' },
  { emoji: '😴', text: 'Feeling tired' },
  { emoji: '🍕', text: 'Cooking dinner' },
  { emoji: '🏃', text: 'Out for a run' },
  { emoji: '📚', text: 'Studying' },
  { emoji: '🎮', text: 'Gaming' },
  { emoji: '✈️', text: 'Traveling' },
];

/**
 * Calculates the end-of-day timestamp (23:59:59.999) for today in local time.
 */
function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function NowStatusModal({
  visible,
  onClose,
  onSave,
  onClear,
  currentStatus,
}: NowStatusModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [emoji, setEmoji] = useState(currentStatus?.emoji || '😊');
  const [text, setText] = useState(currentStatus?.text || '');
  const [selectedDuration, setSelectedDuration] = useState(2); // default: 4 hours
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');

  const hasExistingStatus =
    currentStatus != null && Date.now() < (currentStatus.expiresAt ?? 0);

  const resetForm = useCallback(() => {
    setEmoji('😊');
    setText('');
    setSelectedDuration(2);
    setShowEmojiPicker(false);
    setCustomHours('');
    setCustomMinutes('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSave = useCallback(() => {
    if (!text.trim()) return;

    const now = Date.now();
    let expiresAt: number;
    const option = DURATION_OPTIONS[selectedDuration];

    if (option.label === 'Today') {
      expiresAt = endOfToday();
    } else if (option.label === 'Custom') {
      const h = parseInt(customHours, 10) || 0;
      const m = parseInt(customMinutes, 10) || 0;
      const totalMs = (h * 60 + m) * 60 * 1000;
      expiresAt = now + (totalMs > 0 ? totalMs : 60 * 60 * 1000); // fallback 1h
    } else {
      expiresAt = now + option.ms;
    }

    onSave({
      emoji,
      text: text.trim(),
      updatedAt: now,
      expiresAt,
    });
    resetForm();
  }, [text, emoji, selectedDuration, customHours, customMinutes, onSave, resetForm]);

  const handleClear = useCallback(() => {
    onClear();
    resetForm();
  }, [onClear, resetForm]);

  const handleSuggestion = useCallback(
    (s: { emoji: string; text: string }) => {
      setEmoji(s.emoji);
      setText(s.text);
    },
    [],
  );

  const handleEmojiSelect = useCallback((e: string) => {
    setEmoji(e);
    setShowEmojiPicker(false);
  }, []);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_BEHAVIOR}>
          <Pressable style={styles.backdrop} onPress={handleClose}>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: theme.card,
                  paddingBottom: insets.bottom + 16,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              {/* Header */}
              <View
                style={[styles.header, { borderBottomColor: theme.border }]}
              >
                <Text style={[styles.title, { color: theme.foreground }]}>
                  Set your status
                </Text>
                <Pressable onPress={handleClose} hitSlop={8}>
                  <Text
                    style={[styles.closeBtn, { color: theme.mutedForeground }]}
                  >
                    ✕
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Emoji + text input row */}
                <View style={styles.inputRow}>
                  <Pressable
                    onPress={() => setShowEmojiPicker(true)}
                    style={[
                      styles.emojiButton,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <Text style={styles.emojiPreview}>{emoji}</Text>
                  </Pressable>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="What's happening?"
                    placeholderTextColor={theme.mutedForeground}
                    maxLength={80}
                    style={[
                      styles.textInput,
                      {
                        color: theme.foreground,
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    autoCorrect={false}
                    returnKeyType="done"
                  />
                </View>

                {/* Quick suggestions */}
                <Text
                  style={[styles.sectionLabel, { color: theme.mutedForeground }]}
                >
                  Suggestions
                </Text>
                <View style={styles.suggestionsWrap}>
                  {SUGGESTIONS.map((s) => (
                    <Pressable
                      key={s.text}
                      onPress={() => handleSuggestion(s)}
                      style={[
                        styles.suggestionChip,
                        { backgroundColor: theme.background, borderColor: theme.border },
                      ]}
                    >
                      <Text style={styles.suggestionEmoji}>{s.emoji}</Text>
                      <Text
                        style={[
                          styles.suggestionText,
                          { color: theme.foreground },
                        ]}
                      >
                        {s.text}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Duration picker */}
                <Text
                  style={[styles.sectionLabel, { color: theme.mutedForeground }]}
                >
                  Clear after
                </Text>
                <View style={styles.durationsWrap}>
                  {DURATION_OPTIONS.map((opt, idx) => {
                    const selected = selectedDuration === idx;
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => setSelectedDuration(idx)}
                        style={[
                          styles.durationChip,
                          {
                            backgroundColor: selected
                              ? theme.primary
                              : theme.background,
                            borderColor: selected
                              ? theme.primary
                              : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.durationText,
                            {
                              color: selected
                                ? theme.primaryForeground
                                : theme.foreground,
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Custom duration input */}
                {DURATION_OPTIONS[selectedDuration].label === 'Custom' && (
                  <View style={styles.customRow}>
                    <View style={styles.customField}>
                      <TextInput
                        value={customHours}
                        onChangeText={setCustomHours}
                        placeholder="0"
                        placeholderTextColor={theme.mutedForeground}
                        keyboardType="number-pad"
                        maxLength={3}
                        style={[
                          styles.customInput,
                          {
                            color: theme.foreground,
                            backgroundColor: theme.background,
                            borderColor: theme.border,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.customLabel,
                          { color: theme.mutedForeground },
                        ]}
                      >
                        hours
                      </Text>
                    </View>
                    <View style={styles.customField}>
                      <TextInput
                        value={customMinutes}
                        onChangeText={setCustomMinutes}
                        placeholder="0"
                        placeholderTextColor={theme.mutedForeground}
                        keyboardType="number-pad"
                        maxLength={2}
                        style={[
                          styles.customInput,
                          {
                            color: theme.foreground,
                            backgroundColor: theme.background,
                            borderColor: theme.border,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.customLabel,
                          { color: theme.mutedForeground },
                        ]}
                      >
                        min
                      </Text>
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  {hasExistingStatus && (
                    <Pressable
                      onPress={handleClear}
                      style={[
                        styles.clearButton,
                        { borderColor: theme.destructive },
                      ]}
                    >
                      <Feather
                        name="x-circle"
                        size={16}
                        color={theme.destructive}
                      />
                      <Text
                        style={[
                          styles.clearText,
                          { color: theme.destructive },
                        ]}
                      >
                        Clear status
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={handleSave}
                    disabled={!text.trim()}
                    style={[
                      styles.saveButton,
                      {
                        backgroundColor: text.trim()
                          ? theme.primary
                          : theme.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.saveText,
                        { color: theme.primaryForeground },
                      ]}
                    >
                      Save status
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Emoji picker overlay */}
      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={handleEmojiSelect}
        onClose={() => setShowEmojiPicker(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    fontSize: 20,
    fontWeight: '600',
  },
  body: {
    maxHeight: 500,
  },
  bodyContent: {
    padding: 16,
    gap: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPreview: {
    fontSize: 24,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: -8,
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  suggestionEmoji: {
    fontSize: 14,
  },
  suggestionText: {
    fontSize: 13,
  },
  durationsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  durationText: {
    fontSize: 13,
    fontWeight: '500',
  },
  customRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: -8,
  },
  customField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customInput: {
    width: 56,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  customLabel: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
