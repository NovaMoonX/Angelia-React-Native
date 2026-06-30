import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';

export const CIRCLE_INVITE_ERROR_MESSAGE =
  'This Circle could not be found. The invite link may have expired or the Circle might no longer exist.';

interface CircleInviteErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToFeed?: () => void;
}

export function CircleInviteErrorModal({
  isOpen,
  onClose,
  onGoToFeed,
}: CircleInviteErrorModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Circle not found"
      footer={
        <Button
          onPress={() => {
            onGoToFeed?.();
            onClose();
          }}
          size="lg"
        >
          Go to Feed
        </Button>
      }
    >
      <View style={styles.body}>
        <Text style={styles.emoji}>🔗</Text>
        <Text style={[styles.message, { color: theme.foreground }]}>
          {CIRCLE_INVITE_ERROR_MESSAGE}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  emoji: {
    fontSize: 36,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
