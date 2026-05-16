import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTheme } from '@/hooks/useTheme';

// ─── HOW TO USE THIS MODAL FOR FUTURE UPDATES ────────────────────────────────
//
// 1. Bump BETA_UPDATE_VERSION to a new string (e.g. "1.1.0", "2026-06-01").
//    The modal will automatically show again for all users who haven't seen
//    this version yet.
//
// 2. Update BETA_UPDATE_TITLE with a friendly headline.
//
// 3. Replace BETA_UPDATE_CHANGES with the new list of changes.
//    Each entry has an emoji, a short title, and an optional description.
//
// ─────────────────────────────────────────────────────────────────────────────

const BETA_UPDATE_TITLE = 'Big upgrades are here 🎉';

interface ChangeEntry {
  emoji: string;
  title: string;
  description?: string;
}

// Keep this list to 5 entries max. Focus on the most impactful user-facing
// changes. Minor improvements and bug fixes should be rolled into a single
// "Bug fixes & reliability" entry rather than called out individually.
const BETA_UPDATE_CHANGES: ChangeEntry[] = [
  {
    emoji: '✍️',
    title: 'Edit posts after publishing',
    description: 'You can now update text, circle, priority, captions, and media after a post goes live.',
  },
  {
    emoji: '🎙️',
    title: 'Audio recordings are here',
    description: 'Record clips right in the app, add titles/captions, and keep sharing without leaving your flow.',
  },
  {
    emoji: '🔔',
    title: 'New post activity controls',
    description: 'Choose whether you get notified for new reactions and new conversation messages.',
  },
  {
    emoji: '💬',
    title: 'Edit conversation messages',
    description: 'Double tap your own message to edit it without losing your place in the thread.',
  },
  {
    emoji: '🚀',
    title: 'Smoother performance',
    description: 'The app should feel snappier overall, and posting is steadier now with clearer upload progress. For best results, stay in the app until your post is live.',
  },
];

interface BetaUpdateModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BetaUpdateModal({ visible, onClose }: BetaUpdateModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      isOpen={visible}
      onClose={onClose}
      title={BETA_UPDATE_TITLE}
      footer={
        <Button onPress={onClose} style={styles.doneButton}>
          Got it, thanks!
        </Button>
      }
    >
      <ScrollView
        style={styles.changeList}
        contentContainerStyle={styles.changeListContent}
        showsVerticalScrollIndicator={false}
      >
        {BETA_UPDATE_CHANGES.map((entry, index) => {
          return (
            <View
              key={`change-${index}`}
              style={styles.changeRow}
            >
              <Text style={styles.changeEmoji}>{entry.emoji}</Text>
              <View style={styles.changeText}>
                <Text style={[styles.changeTitle, { color: theme.foreground }]}>
                  {entry.title}
                </Text>
                {entry.description ? (
                  <Text style={[styles.changeDescription, { color: theme.mutedForeground }]}>
                    {entry.description}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  changeList: {
    maxHeight: 500,
  },
  changeListContent: {
    gap: 12,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  changeEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  changeText: {
    flex: 1,
    gap: 3,
  },
  changeTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  changeDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  changeDescriptionHighlight: {
    fontWeight: '700',
  },
  doneButton: {
    alignSelf: 'stretch',
  },
});
