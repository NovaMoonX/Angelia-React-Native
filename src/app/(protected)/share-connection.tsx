import React, { useCallback, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useAppSelector } from '@/store/hooks';
import * as Clipboard from 'expo-clipboard';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { User } from '@/models/types';

/** Returns the deep-link URL for a given user's connection request page. */
function getConnectionLink(userId: string): string {
  return `angelia://connect-request?from=${userId}`;
}

/** Extracts a userId from a scanned connection deep-link, or null if unrecognised. */
function parseConnectionLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === 'angelia:' && url.hostname === 'connect-request') {
      return url.searchParams.get('from');
    }
  } catch {
    // not a valid URL
  }
  return null;
}

// ── Scan QR tab ──────────────────────────────────────────────────────────────

function ScanQrTab() {
  const router = useRouter();
  const { theme } = useTheme();
  const { addToast } = useToast();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const scannedRef = useRef(false);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback(
      (codes) => {
        if (scannedRef.current) return;
        const value = codes[0]?.value;
        if (!value) return;
        const fromId = parseConnectionLink(value);
        if (!fromId) {
          addToast({ type: 'warning', title: "That QR code isn't an Angelia connection code." });
          return;
        }
        scannedRef.current = true;
        router.push({ pathname: '/connect-request', params: { from: fromId } });
      },
      [router, addToast],
    ),
  });

  if (!hasPermission) {
    return (
      <View style={styles.permissionBox}>
        <Text style={[styles.permissionText, { color: theme.mutedForeground }]}>
          Camera access is needed to scan QR codes.
        </Text>
        <Button size="sm" onPress={requestPermission} style={{ marginTop: 12 }}>
          Allow Camera
        </Button>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.permissionBox}>
        <Text style={[styles.permissionText, { color: theme.mutedForeground }]}>
          No camera found on this device.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.scannerContainer}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        codeScanner={codeScanner}
      />
      {/* Viewfinder overlay */}
      <View style={styles.viewfinderOverlay} pointerEvents="none">
        <View style={[styles.viewfinderFrame, { borderColor: theme.primary }]} />
      </View>
      <Text style={styles.scanHint}>Point the camera at someone's Angelia QR code</Text>
    </View>
  );
}

// ── My QR tab ─────────────────────────────────────────────────────────────────

function MyQrTab({
  connectionLink,
  displayName,
  currentUser,
  onShareLink,
  onCopyLink,
}: {
  connectionLink: string;
  displayName: string;
  currentUser: User;
  onShareLink: () => void;
  onCopyLink: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [qrModalVisible, setQrModalVisible] = useState(false);

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.myQrContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
          Share your link or QR code. When someone scans it, they'll send you a connection request — and you approve.
        </Text>

        {/* Handshake card */}
        <View style={[styles.handshakeCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Avatar user={currentUser} size="xl" showStatus={false} />
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
          <Button size="lg" onPress={onShareLink} style={styles.actionBtn}>
            Share Connection Link
          </Button>
          <Button variant="outline" size="lg" onPress={onCopyLink} style={styles.actionBtn}>
            Copy Link
          </Button>
        </View>
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
            onStartShouldSetResponder={() => { return true; }}
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

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ShareConnectionScreen() {
  const { theme } = useTheme();
  const { addToast } = useToast();

  const currentUser = useAppSelector((state) => state.users.currentUser);

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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScreenHeader title="Connect" />

      <Tabs defaultValue="my-qr" style={{ flex: 1 }}>
        <TabsList style={styles.tabsList}>
          <TabsTrigger value="my-qr">My QR</TabsTrigger>
          <TabsTrigger value="scan">Scan QR</TabsTrigger>
        </TabsList>

        <TabsContent value="my-qr" style={{ flex: 1 }}>
          <MyQrTab
            connectionLink={connectionLink}
            displayName={displayName}
            currentUser={currentUser}
            onShareLink={handleShareLink}
            onCopyLink={handleCopyLink}
          />
        </TabsContent>

        <TabsContent value="scan" style={{ flex: 1 }}>
          <ScanQrTab />
        </TabsContent>
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsList: {
    marginHorizontal: 24,
    marginTop: 12,
    marginBottom: 4,
  },
  myQrContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
  // Scanner
  scannerContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderRadius: 16,
  },
  scanHint: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 24,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
