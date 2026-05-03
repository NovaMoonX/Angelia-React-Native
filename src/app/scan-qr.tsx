import React, { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

const ANGELIA_INVITE_RE = /angelia:\/\/invite\/([^/]+)\/([A-Z0-9]{8})/i;
const ANGELIA_CONNECT_RE = /angelia:\/\/connect-request\?from=([^&\s]+)/i;

export default function ScanQRScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanned, setScanned] = useState(false);
  const scannedRef = useRef(false);

  const handleCodeScanned = useCallback(
    (codes: { value?: string }[]) => {
      if (scannedRef.current) return;
      for (const code of codes) {
        if (!code.value) continue;

        // Circle invite QR code: angelia://invite/{channelId}/{inviteCode}
        const inviteMatch = ANGELIA_INVITE_RE.exec(code.value);
        if (inviteMatch) {
          scannedRef.current = true;
          setScanned(true);
          const inviteCode = inviteMatch[2].toUpperCase();
          router.replace({
            pathname: '/join-channel',
            params: { code: inviteCode, autoLookup: '1' },
          });
          return;
        }

        // Connection QR code: angelia://connect-request?from={userId}
        const connectMatch = ANGELIA_CONNECT_RE.exec(code.value);
        if (connectMatch) {
          scannedRef.current = true;
          setScanned(true);
          router.replace({
            pathname: '/connect-request',
            params: { from: connectMatch[1] },
          });
          return;
        }
      }
    },
    [router],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: handleCodeScanned,
  });

  if (!hasPermission) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="x" size={24} color="#FFF" />
        </Pressable>
        <View style={styles.body}>
          <Feather name="camera-off" size={56} color="#555" />
          <Text style={styles.title}>Camera Access Required</Text>
          <Text style={styles.subtitle}>
            Allow Angelia to access your camera to scan invite QR codes.
          </Text>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="x" size={24} color="#FFF" />
        </Pressable>
        <View style={styles.body}>
          <ActivityIndicator color="#FFF" size="large" />
          <Text style={styles.title}>Loading Camera…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scanned}
        codeScanner={codeScanner}
        pixelFormat="yuv"
      />

      {/* Dimmed overlay with cut-out */}
      <View style={styles.overlay}>
        <View style={[styles.overlayRow, { paddingTop: insets.top + 48 }]} />
        <View style={styles.middleRow}>
          <View style={styles.overlaySide} />
          <View style={styles.scanWindow}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayRow} />
      </View>

      {/* Top controls */}
      <View style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.topTitle}>Scan QR Code</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Hint */}
      <View style={[styles.hintRow, { bottom: insets.bottom + 60 }]}>
        <Text style={styles.hintText}>
          Point your camera at a Circle or connection QR code
        </Text>
        <Pressable
          style={styles.enterCodeLink}
          onPress={() => router.back()}
        >
          <Text style={styles.enterCodeLinkText}>Enter code manually instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const SCAN_WINDOW = 240;
const CORNER = 24;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: '#AAA',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 30,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  overlayRow: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  middleRow: {
    flexDirection: 'row',
    height: SCAN_WINDOW,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scanWindow: {
    width: SCAN_WINDOW,
    height: SCAN_WINDOW,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#F59E0B',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
  hintRow: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  hintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
  },
  enterCodeLink: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  enterCodeLinkText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
