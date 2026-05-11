import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAppSelector } from '@/store/hooks';
import { useTheme } from '@/hooks/useTheme';
import { BETA_UPDATE_MODAL_SEEN_KEY, ONBOARDING_FEED_GUIDE_STATE_KEY } from '@/models/constants';

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

/** Bump this whenever you want to show the modal again for a new update. */
const BETA_UPDATE_VERSION = '2026-05-11';

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

export function BetaUpdateModal() {
  const { theme } = useTheme();
  const currentUser = useAppSelector((state) => state.users.currentUser);
  const isDemo = useAppSelector((state) => state.demo.isActive);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!currentUser || isDemo) {
      setIsOpen(false);
      return () => {};
    }

    AsyncStorage.multiGet([
      BETA_UPDATE_MODAL_SEEN_KEY(BETA_UPDATE_VERSION),
      ONBOARDING_FEED_GUIDE_STATE_KEY(currentUser.id),
    ])
      .then((results) => {
        if (cancelled) return;
        const betaSeen = results[0][1];
        const onboardingDismissed = results[1][1] === 'dismissed';
        // Only show if the update hasn't been seen AND the user is past onboarding
        setIsOpen(betaSeen !== 'seen' && onboardingDismissed);
      })
      .catch(() => {
        if (cancelled) return;
        setIsOpen(false);
      });

    return () => { cancelled = true; };
  }, [currentUser, isDemo]);

  const handleDismiss = useCallback(async () => {
    setIsOpen(false);
    try {
      await AsyncStorage.setItem(BETA_UPDATE_MODAL_SEEN_KEY(BETA_UPDATE_VERSION), 'seen');
    } catch {
      // Best-effort
    }
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDismiss}
      title={BETA_UPDATE_TITLE}
      footer={
        <Button onPress={handleDismiss} style={styles.doneButton}>
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
