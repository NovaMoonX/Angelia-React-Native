import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AddReactionIcon } from '@/components/AddReactionIcon';
import { useTheme } from '@/hooks/useTheme';

interface ReactionPillProps {
  emojis: string[];
  onSelect: (emoji: string) => void;
  onOpenPicker?: () => void;
  highlighted?: boolean;
  size?: 'default' | 'compact';
  style?: ViewStyle;
}

export function ReactionPill({
  emojis,
  onSelect,
  onOpenPicker,
  highlighted = false,
  size = 'default',
  style,
}: ReactionPillProps) {
  const { theme } = useTheme();
  const isCompact = size === 'compact';

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: isCompact ? 20 : 24,
          paddingHorizontal: isCompact ? 6 : 8,
          paddingVertical: isCompact ? 2 : 4,
        },
        {
          borderColor: highlighted ? theme.primary : theme.border,
          backgroundColor: theme.background,
        },
        style,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, { gap: isCompact ? 4 : 6 }]}
      >
        {emojis.map((emoji) => {
          return (
            <Pressable
              key={emoji}
              onPress={() => onSelect(emoji)}
              style={[
                styles.emojiButton,
                {
                  width: isCompact ? 36 : 44,
                  height: isCompact ? 36 : 44,
                },
              ]}
            >
              <Text style={[styles.emojiText, { fontSize: isCompact ? 20 : 24 }]}>{emoji}</Text>
            </Pressable>
          );
        })}

        {onOpenPicker ? (
          <Pressable
            onPress={onOpenPicker}
            style={[styles.emojiButton, styles.addButton, { borderColor: theme.border, width: isCompact ? 36 : 44, height: isCompact ? 36 : 44 }]}
          >
            <AddReactionIcon size={isCompact ? 22 : 26} color={theme.mutedForeground} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  content: {
    flexGrow: 1,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    borderWidth: 1,
    borderRadius: 22,
  },
  emojiText: {
    fontSize: 24,
  },
});