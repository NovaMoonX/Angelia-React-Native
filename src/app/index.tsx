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
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store/hooks';
import { enterDemoMode } from '@/store/slices/demoSlice';
import { loadDemoPosts } from '@/store/slices/postsSlice';
import { loadDemoChannels } from '@/store/slices/channelsSlice';
import { loadDemoUsers } from '@/store/slices/usersSlice';
import { loadDemoInvites } from '@/store/slices/invitesSlice';
import { DEMO_DATA } from '@/lib/demoData';

const SPLASH_TO_ACTIONS_DELAY = 600;

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const { firebaseUser, loading, isDemoMode, enterDemo } = useAuth();
  const insets = useSafeAreaInsets();
  const [showActions, setShowActions] = useState(false);
  const didRedirect = useRef(false);

  // Auto-redirect when auth state or demo mode was persisted
  useEffect(() => {
    if (loading || didRedirect.current) return;

    if (firebaseUser) {
      didRedirect.current = true;
      router.replace('/(protected)/feed');
      return;
    }

    if (isDemoMode) {
      didRedirect.current = true;
      dispatch(enterDemoMode());
      dispatch(loadDemoUsers(DEMO_DATA.users));
      dispatch(loadDemoChannels(DEMO_DATA.channels));
      dispatch(loadDemoPosts(DEMO_DATA.posts));
      dispatch(loadDemoInvites(DEMO_DATA.invites));
      router.replace('/(protected)/feed');
    }
  }, [loading, firebaseUser, isDemoMode, dispatch, router]);

  // Animations
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const actionsTranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
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
  }, []);

  const handleTryDemo = async () => {
    await enterDemo();
    dispatch(enterDemoMode());
    dispatch(loadDemoUsers(DEMO_DATA.users));
    dispatch(loadDemoChannels(DEMO_DATA.channels));
    dispatch(loadDemoPosts(DEMO_DATA.posts));
    dispatch(loadDemoInvites(DEMO_DATA.invites));
    router.replace('/(protected)/feed');
  };

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
          Family updates without the noise.{'\n'}Curate, subscribe, connect.
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
          <Button onPress={() => router.push('/auth')} size="lg" style={styles.actionButton}>
            Sign In / Sign Up
          </Button>

          <Pressable onPress={handleTryDemo} style={[styles.demoButton, { backgroundColor: theme.secondary }]}>
            <Text style={styles.demoEmoji}>🎭</Text>
            <View style={styles.demoTextContainer}>
              <Text style={[styles.demoTitle, { color: theme.secondaryForeground }]}>
                Try Demo Mode
              </Text>
              <Text style={[styles.demoDesc, { color: theme.secondaryForeground }]}>
                Explore the app with sample data — no sign up needed
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={theme.secondaryForeground} />
          </Pressable>

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
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  demoEmoji: {
    fontSize: 28,
  },
  demoTextContainer: {
    flex: 1,
  },
  demoTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  demoDesc: {
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
