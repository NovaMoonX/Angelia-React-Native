import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ZoomableImage } from '@/components/ZoomableImage';

interface MediaViewerModalProps {
  /** URI or URL of the media to display */
  uri: string;
  /** 'image' | 'video' */
  mediaType: 'image' | 'video';
  visible: boolean;
  onClose: () => void;
}

function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls
    />
  );
}

/**
 * Full-screen modal viewer for images and videos.
 *
 * Images support pinch-to-zoom (1×–5×), pan while zoomed, and
 * double-tap to toggle 1× ↔ 2.5×.
 *
 * Adapts to the current window dimensions so it works correctly on
 * screen-rotation if the app ever enables landscape mode.
 *
 * For videos, native playback controls are shown.
 */
export function MediaViewerModal({
  uri,
  mediaType,
  visible,
  onClose,
}: MediaViewerModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
    >
      {/* GestureHandlerRootView is required inside a Modal on Android so
          that GestureDetector receives touch events from the modal's
          separate native window. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <View style={styles.overlay}>
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={onClose}
            hitSlop={12}
          >
            <Feather name="x" size={26} color="#FFF" />
          </Pressable>

          {mediaType === 'video' ? (
            visible ? <VideoPlayer uri={uri} /> : null
          ) : (
            <ZoomableImage uri={uri} visible={visible} />
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
