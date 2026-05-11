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
const BETA_UPDATE_VERSION = '1.0.0';

const BETA_UPDATE_TITLE = "What's new in this update ✨";

interface ChangeEntry {
  emoji: string;
  title: string;
  description?: string;
}

const BETA_UPDATE_CHANGES: ChangeEntry[] = [
  {
    emoji: '🔧',
    title: 'Fixed: creating a circle was broken',
  },
  {
    emoji: '💬',
    title: 'New in-app beta feedback button',
  },
  {
    emoji: '✉️',
    title: 'Invite people to your circle directly in the app',
  },
  {
    emoji: '🐛',
    title: 'Fixed stale posts showing old content',
  },
  {
    emoji: '✨',
    title: 'Refreshed layout for post details',
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
    <Modal isOpen={isOpen} onClose={handleDismiss} title={BETA_UPDATE_TITLE}>
      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
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

        <Button onPress={handleDismiss} style={styles.doneButton}>
          Got it, thanks!
        </Button>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  scrollView: {
    maxHeight: 340,
  },
  scrollContent: {
    gap: 12,
    paddingBottom: 4,
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
