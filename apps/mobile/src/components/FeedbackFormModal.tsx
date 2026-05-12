import React, { useCallback } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import type { FeedbackFormConfig } from '@/services/firebase/firestore';

interface FeedbackFormModalProps {
  visible: boolean;
  onClose: () => void;
  config: FeedbackFormConfig | null;
}

export function FeedbackFormModal({ visible, onClose, config }: FeedbackFormModalProps) {
  const { theme } = useTheme();
  const { addToast } = useToast();

  const url = config?.url ?? null;
  const topic = config?.topic ?? null;

  const handleOpen = useCallback(async () => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      try {
        await Clipboard.setStringAsync(url);
        addToast({ message: "Couldn't open the form — the link was copied instead!", type: 'info' });
      } catch {
        // Best-effort
      }
    }
    onClose();
  }, [url, onClose, addToast]);

  return (
    <Modal
      isOpen={visible}
      onClose={onClose}
      title="Quick question for you 💬"
      footer={
        <View style={styles.footer}>
          <Button variant="tertiary" onPress={onClose} style={styles.footerButton}>
            Maybe later
          </Button>
          <Button onPress={handleOpen} style={styles.footerButton}>
            <View style={styles.openButtonContent}>
              <Feather name="external-link" size={15} color="#fff" />
              <Text style={styles.openButtonText}>Open form</Text>
            </View>
          </Button>
        </View>
      }
    >
      <View style={styles.body}>
        {topic ? (
          <Text style={[styles.topic, { color: theme.foreground }]}>
            Topic: {topic}
          </Text>
        ) : null}
        <Text style={[styles.message, { color: theme.foreground }]}>
          We&apos;d love to hear what you think so far. It only takes a minute, and your feedback genuinely shapes where Angelia goes next. 🙏
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: 4,
    gap: 8,
  },
  topic: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
  },
  message: {
    fontSize: 15,
    lineHeight: 23,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
  },
  openButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
