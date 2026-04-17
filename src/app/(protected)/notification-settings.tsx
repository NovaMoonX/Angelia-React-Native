import React, { useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { getDeviceTimeZone } from '@/services/notifications';
import {
  NOTIFICATION_HOUR_OPTIONS,
  NOTIFICATION_TIMEZONES,
} from '@/constants/notifications.constants';

export default function NotificationSettingsScreen() {
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const notificationSettings = useAppSelector(
    (state) => state.users.currentUserNotificationSettings,
  );

  const notifEnabled = notificationSettings?.dailyPromptEnabled ?? true;
  const notifHour = String(notificationSettings?.dailyPromptHour ?? 12);
  const notifTZ = notificationSettings?.timeZone ?? getDeviceTimeZone();

  const handleToggleDailyPrompt = useCallback(async () => {
    try {
      await dispatch(
        saveNotificationSettings({ dailyPromptEnabled: !notifEnabled }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update notification settings' });
    }
  }, [dispatch, notifEnabled, addToast]);

  const handleChangeNotifHour = useCallback(
    async (value: string) => {
      try {
        await dispatch(
          saveNotificationSettings({ dailyPromptHour: parseInt(value, 10) }),
        ).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Failed to update reminder time' });
      }
    },
    [dispatch, addToast],
  );

  const handleChangeTimeZone = useCallback(
    async (value: string) => {
      try {
        await dispatch(saveNotificationSettings({ timeZone: value })).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Failed to update time zone' });
      }
    },
    [dispatch, addToast],
  );

  const selectedHourText =
    NOTIFICATION_HOUR_OPTIONS.find((o) => o.value === notifHour)?.text ?? '12:00 PM';
  const selectedTZText =
    NOTIFICATION_TIMEZONES.find((o) => o.value === notifTZ)?.text ?? notifTZ;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Reminder Settings',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.container}
      >
        {/* Hero section */}
        <View style={[styles.hero, { backgroundColor: theme.secondary }]}>
          <Text style={styles.heroEmoji}>🔔</Text>
          <Text style={[styles.heroTitle, { color: theme.secondaryForeground }]}>
            Daily Reminders
          </Text>
          <Text style={[styles.heroSubtitle, { color: theme.secondaryForeground }]}>
            A gentle nudge to share what's going on — because your people
            actually want to hear from you. 💛
          </Text>
        </View>

        {/* Settings group */}
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>

          {/* Enable toggle */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowEmoji}>✨</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                  Get reminders
                </Text>
                <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                  {notifEnabled ? "On — we'll nudge you daily 💛" : 'Off'}
                </Text>
              </View>
            </View>
            {notificationSettings ? (
              <Switch
                value={notifEnabled}
                onValueChange={handleToggleDailyPrompt}
                trackColor={{ false: theme.muted, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            ) : (
              <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>
                Loading…
              </Text>
            )}
          </View>

          {notifEnabled && notificationSettings ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              {/* Reminder time */}
              <View style={styles.rowStack}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowEmoji}>🕐</Text>
                  <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                    Reminder time
                  </Text>
                </View>
                <Select
                  options={NOTIFICATION_HOUR_OPTIONS}
                  value={notifHour}
                  onChange={handleChangeNotifHour}
                  placeholder="Pick a time"
                />
                <Text style={[styles.rowCaption, { color: theme.mutedForeground }]}>
                  Currently set to {selectedHourText}
                </Text>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              {/* Time zone */}
              <View style={styles.rowStack}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowEmoji}>🌍</Text>
                  <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                    Time zone
                  </Text>
                </View>
                <Select
                  options={NOTIFICATION_TIMEZONES}
                  value={notifTZ}
                  onChange={handleChangeTimeZone}
                  placeholder="Select your time zone"
                />
                <Text style={[styles.rowCaption, { color: theme.mutedForeground }]}>
                  {selectedTZText} — auto-detected on first sign-in
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {notifEnabled && notificationSettings ? (
          <Text style={[styles.footerNote, { color: theme.mutedForeground }]}>
            You'll get a friendly nudge at the time you choose — tap it
            to share a quick update with your circles. 🌟
          </Text>
        ) : null}
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
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 8,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    opacity: 0.85,
    maxWidth: 280,
  },
  group: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowStack: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rowEmoji: {
    fontSize: 20,
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
  rowCaption: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  loadingText: {
    fontSize: 13,
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 32,
  },
});
