import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useAppSelector } from '@/store/hooks';
import * as Clipboard from 'expo-clipboard';

/** Returns the deep-link URL for a given user's connection request page. */
function getConnectionLink(userId: string): string {
  return `angelia://connect-request?from=${userId}`;
}

export default function ShareConnectionScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const insets = useSafeAreaInsets();

  const currentUser = useAppSelector((state) => state.users.currentUser);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  if (!currentUser) return null;

  const connectionLink = getConnectionLink(currentUser.id);
  const displayName = `${currentUser.firstName} ${currentUser.lastName}`;

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `Connect with me on Angelia! 🤝\n\n${connectionLink}`,
        url: Platform.OS === 'ios' ? connectionLink : undefined,
        title: `Connect with ${currentUser.firstName} on Angelia`,
      });
    } catch {
      // User cancelled or share failed — no-op
    }
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(connectionLink);
    addToast({ type: 'success', title: 'Link copied! 📋' });
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
          Share your link or QR code. When someone taps it, they'll send you a connection request — and you approve.
        </Text>

        {/* Handshake card */}
        <View style={[styles.handshakeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Avatar preset={currentUser.avatar} uri={currentUser.avatarUrl} size="xl" />
          <Text style={[styles.cardName, { color: theme.foreground }]}>{displayName}</Text>

          <Pressable
            onPress={() => setQrModalVisible(true)}
            style={[styles.qrContainer, { borderColor: theme.border }]}
          >
            <QRCode
              value={connectionLink}
              size={160}
              color={theme.foreground}
              backgroundColor={theme.card}
            />
            <Text style={[styles.qrHint, { color: theme.mutedForeground }]}>
              Tap to enlarge
            </Text>
          </Pressable>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button size="lg" onPress={handleShareLink} style={styles.actionBtn}>
            Share Connection Link
          </Button>
          <Button variant="outline" size="lg" onPress={handleCopyLink} style={styles.actionBtn}>
            Copy Link
          </Button>
        </View>

        <Pressable onPress={() => router.back()} style={styles.doneRow}>
          <Text style={[styles.doneText, { color: theme.mutedForeground }]}>Done</Text>
        </Pressable>
      </ScrollView>

      {/* QR code overlay modal */}
      <Modal
        visible={qrModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setQrModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setQrModalVisible(false)}
        >
          <View
            style={[styles.modalCard, { backgroundColor: theme.card }]}
            // Prevent touches inside the card from closing the modal
            onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>
              {displayName}
            </Text>
            <QRCode
              value={connectionLink}
              size={240}
              color={theme.foreground}
              backgroundColor={theme.card}
            />
            <Text style={[styles.modalHint, { color: theme.mutedForeground }]}>
              Point a camera here to connect
            </Text>
            <Pressable
              onPress={() => setQrModalVisible(false)}
              style={[styles.modalClose, { borderColor: theme.border }]}
            >
              <Text style={[styles.modalCloseText, { color: theme.foreground }]}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 20,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  handshakeCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  qrHint: {
    fontSize: 12,
  },
  actions: {
    gap: 10,
  },
  actionBtn: {
    width: '100%',
  },
  doneRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  doneText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    width: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  modalClose: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
