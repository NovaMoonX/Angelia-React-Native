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

const BETA_UPDATE_TITLE = "A lot has changed — check it out ✨";

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
    emoji: '📋',
    title: 'Your Post Activity view',
    description: 'See your posts with reaction, private note, and message counts — all in one place. Unread indicators clear as you go.',
  },
  {
    emoji: '🗑️',
    title: 'Delete your posts',
    description: "You can now remove posts you've shared.",
  },
  {
    emoji: '📸',
    title: 'Camera zoom',
    description: 'Pinch to zoom when taking a photo.',
  },
  {
    emoji: '⏱️',
    title: 'Status can stay on until you clear it',
    description: 'The new "until cleared" option makes statuses feel a lot more natural.',
  },
  {
    emoji: '❓',
    title: 'How Angelia works',
    description: 'A quick explainer is now available in the feed and your account screen — handy if you want a refresher.',
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
  doneButton: {
    alignSelf: 'stretch',
  },
});
