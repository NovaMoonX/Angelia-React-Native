import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useToast } from '@/hooks/useToast';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { getDeviceTimeZone } from '@/services/notifications';
import { NOTIFICATION_TIMEZONES } from '@/constants/notifications.constants';
import { Select } from '@/components/ui/Select';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const notificationSettings = useAppSelector(
    (state) => state.users.currentUserNotificationSettings,
  );

  const dailyEnabled = notificationSettings?.dailyPromptEnabled ?? true;
  const notifTZ = notificationSettings?.timeZone ?? getDeviceTimeZone();
  const autoDetect = notificationSettings?.autoDetectTimeZone !== false;

  const handleToggleAutoDetect = useCallback(async () => {
    const newAutoDetect = !autoDetect;
    try {
      const updates: Parameters<typeof saveNotificationSettings>[0] = {
        autoDetectTimeZone: newAutoDetect,
      };
      if (newAutoDetect) {
        updates.timeZone = getDeviceTimeZone();
      }
      await dispatch(saveNotificationSettings(updates)).unwrap();
      if (newAutoDetect) {
        addToast({ type: 'success', title: 'Time zone set to device time zone' });
      }
    } catch {
      addToast({ type: 'error', title: 'Failed to update time zone settings' });
    }
  }, [dispatch, autoDetect, addToast]);

  const handleChangeTimeZone = useCallback(
    async (value: string) => {
      if (value === notifTZ) return;
      try {
        await dispatch(saveNotificationSettings({ timeZone: value })).unwrap();
        addToast({ type: 'success', title: 'Time zone updated' });
      } catch {
        addToast({ type: 'error', title: 'Failed to update time zone' });
      }
    },
    [dispatch, addToast, notifTZ],
  );

  const selectedTZText =
    NOTIFICATION_TIMEZONES.find((o) => o.value === notifTZ)?.text ?? notifTZ;

  return (
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

      {/* Notification types */}
      <View
        style={[
          styles.group,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {/* Daily Reminders */}
        <Pressable
          onPress={() => router.push('/(protected)/daily-reminder-settings')}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowEmoji}>🔔</Text>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                Daily Reminders
              </Text>
              <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                {dailyEnabled ? 'On — a friendly nudge each day 💛' : 'Off'}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={theme.mutedForeground} />
        </Pressable>
      </View>

      {/* Time zone section */}
      <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>
        Time Zone
      </Text>
      <View
        style={[
          styles.group,
          { backgroundColor: theme.card, borderColor: theme.border, marginTop: 8 },
        ]}
      >
        {/* Auto-detect toggle */}
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowEmoji}>📍</Text>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                Auto-detect time zone
              </Text>
              <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                {autoDetect
                  ? `Synced to ${getDeviceTimeZone().replace(/_/g, ' ')} 📍`
                  : 'Set manually below'}
              </Text>
            </View>
          </View>
          {notificationSettings ? (
            <Switch
              value={autoDetect}
              onValueChange={handleToggleAutoDetect}
              trackColor={{ false: theme.muted, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          ) : (
            <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>
              Loading…
            </Text>
          )}
        </View>

        {/* Manual timezone picker (only when auto-detect is off) */}
        {!autoDetect && notificationSettings && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
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
                searchable
                searchPlaceholder="Search cities or regions…"
              />
              <Text style={[styles.rowCaption, { color: theme.mutedForeground }]}>
                {selectedTZText}
              </Text>
            </View>
          </>
        )}
      </View>

      <Text style={[styles.footer, { color: theme.mutedForeground }]}>
        More notification types coming soon — stay tuned! 🚀
      </Text>
    </ScrollView>
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginHorizontal: 20,
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
  rowStack: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
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
  footer: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    marginHorizontal: 32,
  },
});
