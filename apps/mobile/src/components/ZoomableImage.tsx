import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  clamp,
} from 'react-native-reanimated';

interface ZoomableImageProps {
  uri: string;
  /** Pass `visible` so the zoom state is reset when the modal closes. */
  visible: boolean;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_ZOOM = 2.5;

/**
 * A full-screen image viewer that supports:
 *  - Pinch-to-zoom (1×–5×)
 *  - Pan while zoomed
 *  - Double-tap to toggle 1× ↔ 2.5×
 *
 * Intended to be used inside a full-screen `Modal`. Wrap the modal's content
 * in a `GestureHandlerRootView` if gestures don't activate on Android.
 */
export function ZoomableImage({ uri, visible }: ZoomableImageProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset zoom state when the modal closes
  useEffect(() => {
    if (!visible) {
      scale.value = MIN_SCALE;
      savedScale.value = MIN_SCALE;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, MIN_SCALE, MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Snap back to 1× if user releases below the minimum
      if (scale.value < MIN_SCALE + 0.05) {
        scale.value = withSpring(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= MIN_SCALE) return;
      // Limit pan so image can't be dragged completely off screen
      const maxX = (screenWidth * (scale.value - 1)) / 2;
      const maxY = (screenHeight * (scale.value - 1)) / 2;
      translateX.value = clamp(savedTranslateX.value + e.translationX, -maxX, maxX);
      translateY.value = clamp(savedTranslateY.value + e.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(300)
    .onEnd((_e, success) => {
      if (!success) return;
      if (scale.value > MIN_SCALE + 0.05) {
        // Already zoomed → snap back to 1×
        scale.value = withSpring(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // At 1× → zoom to DOUBLE_TAP_ZOOM
        scale.value = withSpring(DOUBLE_TAP_ZOOM);
        savedScale.value = DOUBLE_TAP_ZOOM;
      }
    });

  // Pan and pinch work at the same time; double-tap is mutually exclusive
  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}
