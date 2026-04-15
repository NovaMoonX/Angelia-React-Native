import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { MAX_FILES, MAX_FILE_SIZE_MB } from '@/models/constants';
import { useToast } from '@/hooks/useToast';
import type { MediaFile } from '@/components/PostCreateMediaUploader';

// TODO: Live camera capture will be implemented in a follow-up PR once the
// appropriate camera package and native build configuration are finalised.

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addToast } = useToast();

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
        router.push({
          pathname: '/(protected)/post/new',
          params: { capturedMedia: JSON.stringify(files) },
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Top controls */}
      <View style={[styles.topControls, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="x" size={24} color="#FFF" />
        </Pressable>
      </View>

      {/* Camera placeholder */}
      <View style={styles.placeholder}>
        <Feather name="camera-off" size={56} color="rgba(255,255,255,0.3)" />
        <Text style={styles.placeholderTitle}>Camera Coming Soon</Text>
        <Text style={styles.placeholderBody}>
          Live capture will be available in a future update.{'\n'}
          Use the gallery to attach photos or videos.
        </Text>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 24 }]}>
        {/* Gallery picker */}
        <Pressable
          style={styles.galleryButton}
          onPress={pickFromGallery}
          hitSlop={8}
        >
          <Feather name="image" size={28} color="#FFF" />
          <Text style={styles.galleryLabel}>Gallery</Text>
        </Pressable>

        {/* Disabled shutter placeholder */}
        <View style={[styles.shutterOuter, styles.shutterDisabled]}>
          <View style={[styles.shutterInner, styles.shutterInnerDisabled]} />
        </View>

        {/* Spacer to balance layout */}
        <View style={styles.flipPlaceholder} />
      </View>

      <Text
        style={[styles.hint, { bottom: insets.bottom + 112 }]}
        pointerEvents="none"
      >
        Gallery available · Camera coming soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  placeholderTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  placeholderBody: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: {
    borderColor: 'rgba(255,255,255,0.3)',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF',
  },
  shutterInnerDisabled: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  flipPlaceholder: {
    width: 60,
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
});

