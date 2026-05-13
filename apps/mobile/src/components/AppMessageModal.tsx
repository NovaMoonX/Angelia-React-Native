import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTheme } from '@/hooks/useTheme';
import type { BroadcastMessageConfig, BroadcastMessageType } from '@/services/firebase/firestore';

interface AppMessageModalProps {
  visible: boolean;
  onClose: () => void;
  config: BroadcastMessageConfig | null;
}

interface TypeStyle {
  emoji: string;
  accentColor: string;
}

function getTypeStyle(type: BroadcastMessageType): TypeStyle {
  switch (type) {
    case 'warning':
      return { emoji: '⚠️', accentColor: '#F59E0B' };
    case 'success':
      return { emoji: '✅', accentColor: '#10B981' };
    case 'urgent':
      return { emoji: '🚨', accentColor: '#EF4444' };
    case 'info':
    default:
      return { emoji: '💡', accentColor: '#6366F1' };
  }
}

export function AppMessageModal({ visible, onClose, config }: AppMessageModalProps) {
  const { theme } = useTheme();

  const type: BroadcastMessageType = config?.type ?? 'info';
  const { emoji, accentColor } = getTypeStyle(type);
  const title = config?.title ?? '';
  const body = config?.body ?? '';

  return (
    <Modal
      isOpen={visible}
      onClose={onClose}
      title={`${emoji} ${title}`}
      footer={
        <Button onPress={onClose} style={styles.button}>
          Got it
        </Button>
      }
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <Text style={[styles.body, { color: theme.foreground }]}>{body}</Text>
    </Modal>
  );
}

const styles = StyleSheet.create({
  accentBar: {
    height: 3,
    borderRadius: 2,
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
  },
  button: {
    alignSelf: 'stretch',
  },
});
