import React, { useRef, useState, useCallback } from 'react';
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
  useMicrophonePermission,
} from 'react-native-vision-camera';
import type { CameraPosition, PhotoFile, VideoFile } from 'react-native-vision-camera';
import type { MediaFile } from '@/components/PostCreateMediaUploader';

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [position, setPosition] = useState<CameraPosition>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [recording, setRecording] = useState(false);
  const camera = useRef<Camera>(null);

  const { hasPermission: hasCameraPermission, requestPermission: requestCamera } =
    useCameraPermission();
  const { hasPermission: hasMicPermission, requestPermission: requestMic } =
    useMicrophonePermission();

  const device = useCameraDevice(position);

  const handleRequestPermissions = useCallback(async () => {
    await requestCamera();
    await requestMic();
  }, [requestCamera, requestMic]);

  const togglePosition = () =>
    setPosition((prev) => (prev === 'back' ? 'front' : 'back'));

  const toggleFlash = () =>
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));

  const navigateWithMedia = (file: MediaFile) => {
    router.push({
      pathname: '/(protected)/post/new',
      params: { capturedMedia: JSON.stringify([file]) },
    });
  };

  const takePhoto = async () => {
    if (!camera.current) return;
    try {
      const photo: PhotoFile = await camera.current.takePhoto({
        flash,
      });
      const uri = `file://${photo.path}`;
      navigateWithMedia({ uri, name: `photo-${Date.now()}.jpg`, type: 'image/jpeg' });
    } catch {
      // silently ignore cancelled / failed captures
    }
  };

  const startRecording = () => {
    if (!camera.current || recording) return;
    setRecording(true);
    camera.current.startRecording({
      flash: flash === 'on' ? 'on' : 'off',
      onRecordingFinished: (video: VideoFile) => {
        setRecording(false);
        const uri = `file://${video.path}`;
        navigateWithMedia({ uri, name: `video-${Date.now()}.mp4`, type: 'video/mp4' });
      },
      onRecordingError: () => {
        setRecording(false);
      },
    });
  };

  const stopRecording = async () => {
    if (!camera.current || !recording) return;
    await camera.current.stopRecording();
  };

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!hasCameraPermission) {
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
            Allow Angelia to access your camera to capture photos and videos.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleRequestPermissions}>
            <Text style={styles.primaryButtonText}>Grant Permission</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace('/(protected)/gallery')}
          >
            <Feather name="image" size={16} color="#888" />
            <Text style={styles.secondaryButtonText}>Use Gallery Instead</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── No device found ────────────────────────────────────────────────────────
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

  // ── Active camera ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        photo
        video={hasMicPermission}
        audio={hasMicPermission}
      />

      {/* Top controls */}
      <View style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconButton} onPress={() => router.back()} hitSlop={12}>
          <Feather name="x" size={24} color="#FFF" />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={toggleFlash} hitSlop={12}>
          <Feather name={flash === 'on' ? 'zap' : 'zap-off'} size={22} color="#FFF" />
        </Pressable>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 16 }]}>
        {/* Gallery shortcut */}
        <Pressable
          style={styles.iconButton}
          onPress={() => router.replace('/(protected)/gallery')}
          hitSlop={8}
        >
          <Feather name="image" size={26} color="#FFF" />
        </Pressable>

        {/* Shutter */}
        <Pressable
          style={[styles.shutter, recording && styles.shutterRecording]}
          onPress={recording ? stopRecording : takePhoto}
          onLongPress={hasMicPermission ? startRecording : undefined}
          delayLongPress={400}
        >
          {recording && <View style={styles.recordingDot} />}
        </Pressable>

        {/* Flip camera */}
        <Pressable style={styles.iconButton} onPress={togglePosition} hitSlop={8}>
          <Feather name="refresh-ccw" size={26} color="#FFF" />
        </Pressable>
      </View>

      {recording && (
        <View style={[styles.recordingBadge, { top: insets.top + 60 }]}>
          <View style={styles.recordingIndicator} />
          <Text style={styles.recordingText}>REC</Text>
        </View>
      )}
    </View>
  );
}

const SHUTTER_SIZE = 72;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
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
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 32,
    zIndex: 10,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    backgroundColor: '#FFF',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRecording: {
    backgroundColor: '#EF4444',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  recordingDot: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  recordingBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 10,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

