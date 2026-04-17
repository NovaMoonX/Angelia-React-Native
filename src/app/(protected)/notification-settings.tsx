import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAppSelector } from '@/store/hooks';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const notificationSettings = useAppSelector(
    (state) => state.users.currentUserNotificationSettings,
  );

  const dailyEnabled = notificationSettings?.dailyPromptEnabled ?? true;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notification Settings',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.container}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>⚙️</Text>
          <Text style={[styles.heroSubtitle, { color: theme.mutedForeground }]}>
            Choose which notifications you'd like to receive.
          </Text>
        </View>

        {/* Settings list */}
        <View
          style={[
            styles.group,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          {/* Daily Reminders */}
          <Pressable
            onPress={() =>
              router.push('/(protected)/daily-reminder-settings')
            }
            style={({ pressed }) => [
              styles.row,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.rowEmoji}>🔔</Text>
              <View style={styles.rowText}>
                <Text
                  style={[styles.rowLabel, { color: theme.foreground }]}
                >
                  Daily Reminders
                </Text>
                <Text
                  style={[styles.rowSub, { color: theme.mutedForeground }]}
                >
                  {dailyEnabled
                    ? 'On — a friendly nudge each day 💛'
                    : 'Off'}
                </Text>
              </View>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={theme.mutedForeground}
            />
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: theme.mutedForeground }]}>
          More notification types coming soon — stay tuned! 🚀
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 6,
  },
  heroEmoji: {
    fontSize: 36,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 260,
  },
  group: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowEmoji: {
    fontSize: 22,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    marginHorizontal: 32,
  },
});
