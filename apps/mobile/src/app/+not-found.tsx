import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function NotFoundScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/');
    }, 2000);
    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <Text style={styles.emoji}>🔍</Text>
      <Text style={[styles.title, { color: theme.foreground }]}>
        404 — Page Not Found
      </Text>
      <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
        Redirecting you home in 2 seconds...
      </Text>
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
  },
});
