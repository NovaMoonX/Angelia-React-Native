import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AngeliaLogo } from '@/components/AngeliaLogo';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/Loading';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store/hooks';
import { enterDemoMode } from '@/store/actions/demoActions';

const SPLASH_TO_ACTIONS_DELAY = 600;

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const { firebaseUser, loading: authLoading, isDemoMode, enterDemo } = useAuth();
  const insets = useSafeAreaInsets();
  const [showActions, setShowActions] = useState(false);
  const didRedirect = useRef(false);

  // Auto-redirect when auth state or demo mode was persisted
  useEffect(() => {
    if (authLoading || didRedirect.current) return;

    if (firebaseUser) {
      didRedirect.current = true;
      router.replace('/(protected)/feed');
      return;
    }

    if (isDemoMode) {
      didRedirect.current = true;
      dispatch(enterDemoMode());
      router.replace('/(protected)/feed');
    }
  }, [authLoading, firebaseUser, isDemoMode, dispatch, router]);

  // Animations
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsTranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // Don't start animations while auth is still resolving — wait until we
    // know the user is unauthenticated (and will actually see this screen).
    if (authLoading) return;

    // Reset animation values so the sequence always plays from scratch.
    logoScale.setValue(0.5);
    logoOpacity.setValue(0);
    titleOpacity.setValue(0);
    sloganOpacity.setValue(0);
    actionsOpacity.setValue(0);
    actionsTranslateY.setValue(40);
    setShowActions(false);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Splash entrance animation
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(sloganOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After splash animations, transition to actions
      timeoutId = setTimeout(() => {
        setShowActions(true);
        Animated.parallel([
          Animated.timing(actionsOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(actionsTranslateY, {
            toValue: 0,
            friction: 8,
            tension: 40,
            useNativeDriver: true,
          }),
        ]).start();
      }, SPLASH_TO_ACTIONS_DELAY);
    });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    authLoading,
    logoScale, logoOpacity, titleOpacity, sloganOpacity, actionsOpacity, actionsTranslateY,
    setShowActions,
  ]);

  const handleTryDemo = async () => {
    await enterDemo();
    dispatch(enterDemoMode());
    router.replace('/(protected)/feed');
  };

  // Show a loading indicator while auth state is resolving so the user gets
  // visual feedback instead of a blank screen.
  if (authLoading) {
    return <Loading />;
  }

  return (
    <View
      style={[
        styles.fullScreen,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* Centered splash content */}
      <View style={styles.splashCenter}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <AngeliaLogo size={80} />
        </Animated.View>

        <Animated.Text
          style={[
            styles.heroTitle,
            { color: theme.foreground, opacity: titleOpacity },
          ]}
        >
          Angelia
        </Animated.Text>

        <Animated.Text
          style={[
            styles.heroSubtitle,
            { color: theme.mutedForeground, opacity: sloganOpacity },
          ]}
        >
          Family updates without the noise.{'\n'}Share, join, connect.
        </Animated.Text>
      </View>

      {/* Action buttons that animate in */}
      {showActions && (
        <Animated.View
          style={[
            styles.actionsContainer,
            {
              opacity: actionsOpacity,
              transform: [{ translateY: actionsTranslateY }],
            },
          ]}
        >
          <Pressable
            onPress={() => router.push('/join-channel')}
            style={[styles.joinChannelButton, { backgroundColor: theme.primary }]}
          >
            <Feather name="users" size={24} color={theme.primaryForeground} />
            <View style={styles.joinChannelTextContainer}>
              <Text style={[styles.joinChannelTitle, { color: theme.primaryForeground }]}>
                Join a Circle
              </Text>
              <Text style={[styles.joinChannelDesc, { color: theme.primaryForeground }]}>
                Got an invite code? Hop in and start connecting!
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={theme.primaryForeground} />
          </Pressable>

          <Button
            variant="outline"
            onPress={() => router.push('/auth')}
            size="lg"
            style={styles.actionButton}
          >
            Sign In with Email
          </Button>

          <Button
            variant="tertiary"
            onPress={handleTryDemo}
            style={styles.actionButton}
          >
            🎭 Try Demo Mode
          </Button>

          <Pressable onPress={() => router.push('/about')} style={styles.learnMoreButton}>
            <Feather name="info" size={16} color={theme.primary} />
            <Text style={[styles.learnMoreLink, { color: theme.primary }]}>
              Learn more about Angelia
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  splashCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  actionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
  },
  actionButton: {
    width: '100%',
  },
  joinChannelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  joinChannelTextContainer: {
    flex: 1,
  },
  joinChannelTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  joinChannelDesc: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  learnMoreLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
