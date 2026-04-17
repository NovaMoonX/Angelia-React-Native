import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Separator } from '@/components/ui/Separator';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { getDeviceTimeZone } from '@/services/notifications';
import {
  NOTIFICATION_HOUR_OPTIONS,
  NOTIFICATION_TIMEZONES,
} from '@/constants/notifications.constants';

export function NotificationsTab() {
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
        addToast({ type: 'error', title: 'Failed to update notification time' });
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

  return (
    <Card style={styles.notifCard}>
      <Text style={[styles.notifHeading, { color: theme.foreground }]}>
        Daily Prompt
      </Text>
      <Text style={[styles.notifSubtext, { color: theme.mutedForeground }]}>
        We'll send you a gentle nudge to share what's going on — no pressure,
        just a friendly reminder that people want to hear from you. 💛
      </Text>

      {/* Enable / disable toggle */}
      <View style={styles.notifRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.notifRowLabel, { color: theme.foreground }]}>
            Get reminders
          </Text>
          <Text style={[styles.notifRowSub, { color: theme.mutedForeground }]}>
            {notifEnabled ? "On — we'll remind you 💛" : 'Off'}
          </Text>
        </View>
        {notificationSettings ? (
          <Toggle checked={notifEnabled} onToggle={handleToggleDailyPrompt} />
        ) : (
          <Text style={{ color: theme.mutedForeground, fontSize: 13 }}>Loading…</Text>
        )}
      </View>

      {notifEnabled && notificationSettings ? (
        <>
          <Separator style={{ marginVertical: 12 }} />

          {/* Time picker */}
          <View style={styles.notifField}>
            <Label>Notification time</Label>
            <Select
              options={NOTIFICATION_HOUR_OPTIONS}
              value={notifHour}
              onChange={handleChangeNotifHour}
              placeholder="Pick a time"
            />
          </View>

          {/* Timezone picker */}
          <View style={[styles.notifField, { marginTop: 12 }]}>
            <Label>Time zone</Label>
            <Select
              options={NOTIFICATION_TIMEZONES}
              value={notifTZ}
              onChange={handleChangeTimeZone}
              placeholder="Select your time zone"
            />
            <Text style={[styles.notifTZHint, { color: theme.mutedForeground }]}>
              Auto-detected from your device on first sign-in. Change it here
              if you prefer a different zone.
            </Text>
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  notifCard: {
    padding: 20,
    marginBottom: 16,
  },
  notifHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  notifSubtext: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifRowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  notifRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  notifField: {
    gap: 6,
  },
  notifTZHint: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
});
