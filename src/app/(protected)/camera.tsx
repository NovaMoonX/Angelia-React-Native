import React, { useRef, useState, useCallback } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { MAX_FILES, MAX_FILE_SIZE_MB } from '@/models/constants';
import { useToast } from '@/hooks/useToast';
import type { MediaFile } from '@/components/PostCreateMediaUploader';

const VIDEO_MAX_DURATION_SECONDS = 60;

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addToast } = useToast();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const cameraRef = useRef<CameraView>(null);

  const permissionsGranted =
    cameraPermission?.granted && micPermission?.granted;

  const requestPermissions = useCallback(async () => {
    await requestCameraPermission();
    await requestMicPermission();
  }, [requestCameraPermission, requestMicPermission]);

  const flipCamera = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((prev) => (prev === 'off' ? 'on' : 'off'));
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || isRecording) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) {
        const file: MediaFile = {
          uri: photo.uri,
          name: `photo-${Date.now()}.jpg`,
          type: 'image/jpeg',
        };
        goToCompose([file]);
      }
    } catch (_err) {
      addToast({ type: 'error', title: 'Could not take photo' });
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: VIDEO_MAX_DURATION_SECONDS,
      });
      if (video) {
        const file: MediaFile = {
          uri: video.uri,
          name: `video-${Date.now()}.mp4`,
          type: 'video/mp4',
        };
        goToCompose([file]);
      }
    } catch (err) {
      if (err instanceof Error && err.message !== 'Recording was stopped') {
        addToast({ type: 'error', title: 'Could not record video' });
      }
    } finally {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FILES,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const rejected: string[] = [];
      const files: MediaFile[] = result.assets
        .filter((asset) => {
          if (
            asset.fileSize &&
            asset.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024
          ) {
            rejected.push(asset.fileName || 'file');
            return false;
          }
          return true;
        })
        .map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `media-${Date.now()}`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        }));

      if (rejected.length > 0) {
        addToast({
          type: 'warning',
          title: `${rejected.length} file(s) skipped — over ${MAX_FILE_SIZE_MB}MB limit`,
        });
      }

      if (files.length > 0) {
        goToCompose(files);
      }
    }
  };

  const goToCompose = (capturedMedia: MediaFile[]) => {
    router.push({
      pathname: '/(protected)/post/new',
      params: {
        capturedMedia: JSON.stringify(capturedMedia),
      },
    });
  };

  if (!permissionsGranted) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <Feather name="camera-off" size={56} color="#888" />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionBody}>
          Angelia needs access to your camera and microphone to capture photos
          and videos.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </Pressable>
        <Pressable
          style={styles.permissionSkip}
          onPress={() => router.push('/(protected)/post/new')}
        >
          <Text style={styles.permissionSkipText}>Upload instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        mode={isRecording ? 'video' : 'picture'}
        videoQuality="1080p"
      />

      {/* Top controls */}
      <View
        style={[
          styles.topControls,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <Pressable
          style={styles.iconButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="x" size={24} color="#FFF" />
        </Pressable>

        <Pressable
          style={styles.iconButton}
          onPress={toggleFlash}
          hitSlop={12}
        >
          <Feather
            name={flash === 'on' ? 'zap' : 'zap-off'}
            size={22}
            color="#FFF"
          />
        </Pressable>
      </View>

      {/* Recording indicator */}
      {isRecording && (
        <View style={[styles.recordingBadge, { top: insets.top + 56 }]}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>REC</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View
        style={[
          styles.bottomControls,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Gallery picker */}
        <Pressable
          style={styles.galleryButton}
          onPress={pickFromGallery}
          hitSlop={8}
        >
          <Feather name="image" size={28} color="#FFF" />
          <Text style={styles.galleryLabel}>Gallery</Text>
        </Pressable>

        {/* Shutter */}
        <Pressable
          style={[
            styles.shutterOuter,
            isRecording && styles.shutterRecording,
          ]}
          onPress={isRecording ? stopRecording : capturePhoto}
          onLongPress={startRecording}
          delayLongPress={300}
        >
          <View
            style={[
              styles.shutterInner,
              isRecording && styles.shutterInnerRecording,
            ]}
          />
        </Pressable>

        {/* Flip camera */}
        <Pressable
          style={styles.flipButton}
          onPress={flipCamera}
          hitSlop={8}
        >
          <Feather name="refresh-cw" size={28} color="#FFF" />
          <Text style={styles.flipLabel}>Flip</Text>
        </Pressable>
      </View>

      {/* Capture hint */}
      {!isRecording && (
        <Text
          style={[styles.hint, { bottom: insets.bottom + 112 }]}
          pointerEvents="none"
        >
          Tap for photo · Hold for video
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionBody: {
    color: '#AAA',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    marginTop: 8,
  },
  permissionButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  permissionSkip: {
    paddingVertical: 8,
  },
  permissionSkipText: {
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
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  recordingText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
  },
  galleryButton: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  galleryLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500',
  },
  flipButton: {
    alignItems: 'center',
    gap: 4,
    width: 60,
  },
  flipLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500',
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRecording: {
    borderColor: '#DC2626',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
  },
  shutterInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#DC2626',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
});
