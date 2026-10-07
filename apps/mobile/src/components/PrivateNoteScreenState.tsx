import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme } from '@/hooks/useTheme';

interface PrivateNoteScreenStateProps {
  headerTitle: string;
  /** `loading` shows a spinner; `unavailable` explains why there is nothing to show and offers a way out. */
  status: 'loading' | 'unavailable';
  onBack: () => void;
  backLabel?: string;
}

/**
 * Shared placeholder for the private-note screens while their data is still on
 * its way (cold start from a push notification) or when the post/note can no
 * longer be opened. Replaces the blank screen those routes used to show, and
 * always keeps a header + button so the user is never stuck.
 */
export function PrivateNoteScreenState({
  headerTitle,
  status,
  onBack,
  backLabel = 'Go back',
}: PrivateNoteScreenStateProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title={headerTitle} onBack={onBack} />
      <View style={styles.body}>
        {status === 'loading' ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : (
          <>
            <Text style={[styles.title, { color: theme.foreground }]}>
              This private note isn't available
            </Text>
            <Text style={[styles.description, { color: theme.mutedForeground }]}>
              The post may have been deleted, or the note is no longer shared with you.
            </Text>
            <Button variant="outline" onPress={onBack}>
              {backLabel}
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
