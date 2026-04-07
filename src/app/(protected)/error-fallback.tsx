import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

export default function ErrorFallbackScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { theme } = useTheme();

  const handleGoHome = () => {
    router.replace('/');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/');
    } catch {
      // Already going home
      router.replace('/');
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={[styles.title, { color: theme.foreground }]}>
        Something went wrong
      </Text>
      <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
        We encountered an unexpected error. Please try again.
      </Text>

      <View style={styles.actions}>
        <Button onPress={handleGoHome}>Go Home</Button>
        <Button variant="outline" onPress={handleSignOut}>
          Sign Out
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  actions: {
    gap: 12,
    width: '100%',
    maxWidth: 280,
  },
});
