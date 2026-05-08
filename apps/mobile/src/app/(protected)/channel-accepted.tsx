import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';

export default function ChannelAcceptedScreen() {
  const { channelName } = useLocalSearchParams<{ channelName?: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const displayName = channelName ?? 'the channel';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <Text style={styles.emoji}>🎉</Text>
        <Text style={[styles.title, { color: theme.foreground }]}>You're in!</Text>
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
          You've been accepted into{' '}
          <Text style={[styles.channelName, { color: theme.foreground }]}>{displayName}</Text>
          . Start exploring and enjoy the vibes!
        </Text>

        <View style={styles.actions}>
          <Button size="lg" onPress={() => router.push('/(protected)/feed')}>
            Go to Feed
          </Button>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  channelName: {
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    marginTop: 24,
  },
});
