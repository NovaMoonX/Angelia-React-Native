import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useAppDispatch } from '@/store/hooks';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { uploadPost } from '@/store/actions/postActions';
import { saveStatus } from '@/store/actions/userActions';
import type { MediaFile } from '@/components/PostCreateMediaUploader';
import type { PostTier, UserStatus } from '@/models/types';

// How long to wait before revealing the upload UI (prevents flash on quick uploads)
const REVEAL_DELAY_MS = 600;
// Maximum time to show the uploading screen before sending to background
const MAX_UPLOAD_DISPLAY_MS = 6000;
// How long to show the background message before navigating to feed
const BACKGROUND_MESSAGE_DURATION_MS = 1500;

type UploadPhase =
  | 'pending'   // < REVEAL_DELAY_MS – nothing visible
  | 'uploading' // animated loading state
  | 'success'   // quick success flash
  | 'error'     // something went wrong
  | 'background'; // taking too long, sent to background

export default function PostUploadingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const params = useLocalSearchParams<{
    channelId: string;
    text: string;
    mediaJson: string;
    tier: string;
    pendingStatusJson?: string;
  }>();

  const [phase, setPhase] = useState<UploadPhase>('pending');
  const [errorMessage, setErrorMessage] = useState('');
  const phaseRef = useRef<UploadPhase>('pending');
  const uploadStartedRef = useRef(false);

  // Animations
  const opacity = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  const setPhaseAndRef = (p: UploadPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // Reveal animation (fade + scale in)
  const runReveal = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, useNativeDriver: true }),
    ]).start();
  };

  // Continuous spin animation for the ring
  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();
    return () => spinLoop.stop();
  }, [spin]);

  // Pulse animation for the inner icon
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.15, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseScale]);

  const navigateToFeed = () => {
    router.replace('/(protected)/feed');
  };

  const sendPostReadyNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Angelia',
          body: "Your post just dropped! 🎉 Tap to check it out.",
        },
        trigger: null,
      });
    } catch {
      // Best-effort
    }
  };

  const runSuccessAnimation = (afterMs: number, onDone: () => void) => {
    setPhaseAndRef('success');
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(onDone, afterMs);
  };

  useEffect(() => {
    if (uploadStartedRef.current) return;
    uploadStartedRef.current = true;

    const media: MediaFile[] = params.mediaJson ? (() => {
      try { return JSON.parse(params.mediaJson) as MediaFile[]; } catch { return []; }
    })() : [];

    const pendingStatus: UserStatus | null = params.pendingStatusJson ? (() => {
      try { return JSON.parse(params.pendingStatusJson) as UserStatus; } catch { return null; }
    })() : null;

    const tier = (params.tier || 'everyday') as PostTier;

    // After REVEAL_DELAY_MS, reveal the UI if still uploading
    const revealTimer = setTimeout(() => {
      if (phaseRef.current === 'pending') {
        setPhaseAndRef('uploading');
        runReveal();
      }
    }, REVEAL_DELAY_MS);

    // After MAX_UPLOAD_DISPLAY_MS, bail to feed and continue in background
    const bgTimer = setTimeout(() => {
      if (phaseRef.current === 'uploading' || phaseRef.current === 'pending') {
        setPhaseAndRef('background');
        runReveal();
        setTimeout(() => navigateToFeed(), BACKGROUND_MESSAGE_DURATION_MS);
      }
    }, MAX_UPLOAD_DISPLAY_MS);

    dispatch(
      uploadPost({
        channelId: params.channelId,
        text: params.text || '',
        media,
        tier,
      })
    )
      .unwrap()
      .then(async () => {
        clearTimeout(revealTimer);
        clearTimeout(bgTimer);

        // Save pending status
        if (pendingStatus) {
          try { await dispatch(saveStatus(pendingStatus)).unwrap(); } catch { /* ignore */ }
        }

        if (phaseRef.current === 'background') {
          // Already navigated to feed — send notification or toast
          if (appStateRef.current !== 'active') {
            sendPostReadyNotification();
          } else {
            addToast({ type: 'success', title: "Your post is live! 🎉" });
          }
          return;
        }

        // Still on uploading screen
        if (phaseRef.current === 'pending') {
          // Completed before reveal threshold — skip the screen entirely
          clearTimeout(revealTimer);
          navigateToFeed();
          return;
        }

        // Show success, then navigate
        runSuccessAnimation(900, () => navigateToFeed());
      })
      .catch((err: unknown) => {
        clearTimeout(revealTimer);
        clearTimeout(bgTimer);

        if (phaseRef.current === 'background') {
          // Already sent to background — can't show error UI; toast if in-app
          if (appStateRef.current === 'active') {
            addToast({
              type: 'error',
              title: err instanceof Error ? err.message : 'Failed to create post',
            });
          }
          return;
        }

        setPhaseAndRef('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to create post');
        // If error happened before UI was revealed, we still need to show it
        runReveal();
      });

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(bgTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (phase === 'pending') {
    return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      {phase === 'uploading' && (
        <View style={styles.center}>
          {/* Spinning ring */}
          <View style={styles.ringWrapper}>
            <Animated.View
              style={[
                styles.ring,
                { borderTopColor: theme.primary, transform: [{ rotate: spinInterpolate }] },
              ]}
            />
            {/* Pulsing emoji inside */}
            <Animated.Text
              style={[styles.centerEmoji, { transform: [{ scale: pulseScale }] }]}
            >
              🚀
            </Animated.Text>
          </View>
          <Text style={[styles.title, { color: theme.foreground }]}>
            Sharing with your crew...
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            Hang tight while your post goes up ✨
          </Text>
        </View>
      )}

      {phase === 'background' && (
        <View style={styles.center}>
          <Text style={styles.bgEmoji}>⏳</Text>
          <Text style={[styles.title, { color: theme.foreground }]}>
            Taking a bit longer...
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            We'll let you know when your post is live.
          </Text>
        </View>
      )}

      {phase === 'success' && (
        <Animated.View
          style={[
            styles.center,
            { opacity: successOpacity, transform: [{ scale: successScale }] },
          ]}
        >
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={[styles.title, { color: theme.foreground }]}>
            Your post is live!
          </Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
            Your crew can now see it 🙌
          </Text>
        </Animated.View>
      )}

      {phase === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>😬</Text>
          <Text style={[styles.title, { color: theme.foreground }]}>
            Something went wrong
          </Text>
          <Text style={[styles.errorMsg, { color: theme.mutedForeground }]}>
            {errorMessage || 'Failed to create post'}
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: theme.muted }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.buttonText, { color: theme.foreground }]}>
              ← Go back and try again
            </Text>
          </Pressable>
          <Pressable
            onPress={navigateToFeed}
            hitSlop={12}
          >
            <Text style={[styles.dismissText, { color: theme.mutedForeground }]}>
              Dismiss
            </Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  ringWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ring: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  centerEmoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  bgEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  successEmoji: {
    fontSize: 60,
    marginBottom: 4,
  },
  errorEmoji: {
    fontSize: 52,
    marginBottom: 4,
  },
  errorMsg: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dismissText: {
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
});
