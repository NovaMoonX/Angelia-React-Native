import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

/**
 * Camera screen – placeholder until the camera integration is finalized.
 * The real implementation will use a native camera library determined in a
 * follow-up PR.  For now, users can navigate back or go to the gallery.
 */
export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: insets.top + 8 }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Feather name="x" size={24} color="#FFF" />
      </Pressable>

      {/* Placeholder content */}
      <View style={styles.body}>
        <Feather name="camera-off" size={56} color="#555" />
        <Text style={styles.title}>Camera Coming Soon</Text>
        <Text style={styles.subtitle}>
          Native camera capture is being set up.{'\n'}
          Use the gallery to attach media for now.
        </Text>

        <Pressable
          style={styles.galleryButton}
          onPress={() => router.replace('/(protected)/gallery')}
        >
          <Feather name="image" size={18} color="#000" />
          <Text style={styles.galleryButtonText}>Open Gallery</Text>
        </Pressable>

        <Pressable
          style={styles.composeButton}
          onPress={() => router.push('/(protected)/post/new')}
        >
          <Text style={styles.composeButtonText}>Text-only post</Text>
        </Pressable>
      </View>
    </View>
  );
}

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
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 30,
    marginTop: 8,
  },
  galleryButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  composeButton: {
    paddingVertical: 8,
  },
  composeButtonText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
