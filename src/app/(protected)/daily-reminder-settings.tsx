import React, { useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { saveNotificationSettings } from '@/store/actions/notificationActions';
import { getDeviceTimeZone } from '@/services/notifications';
import { NOTIFICATION_TIMEZONES } from '@/constants/notifications.constants';

/** Formats a 24-hour hour + minute into a human-readable 12-hour string, e.g. "2:30 PM". */
function formatTime(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const minuteStr = minute === 0 ? '00' : String(minute).padStart(2, '0');
  return `${displayHour}:${minuteStr} ${suffix}`;
}

/** Builds a Date object for today with the given hour and minute (local time). */
function buildTimeDate(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

export default function DailyReminderSettingsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { addToast } = useToast();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const notificationSettings = useAppSelector(
    (state) => state.users.currentUserNotificationSettings,
  );

  const notifEnabled = notificationSettings?.dailyPromptEnabled ?? true;
  const notifHour = notificationSettings?.dailyPromptHour ?? 12;
  const notifMinute = notificationSettings?.dailyPromptMinute ?? 0;
  const notifTZ = notificationSettings?.timeZone ?? getDeviceTimeZone();
  // Treat missing field (legacy docs) as true
  const autoDetect = notificationSettings?.autoDetectTimeZone !== false;

  // iOS time picker modal state
  const [showIosTimePicker, setShowIosTimePicker] = useState(false);
  const [iosPickerDate, setIosPickerDate] = useState<Date>(() =>
    buildTimeDate(notifHour, notifMinute),
  );
  // Android time picker (shown as native dialog by conditionally rendering)
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  // ---- Handlers ----

  const handleToggleDailyPrompt = useCallback(async () => {
    try {
      await dispatch(
        saveNotificationSettings({ dailyPromptEnabled: !notifEnabled }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update notification settings' });
    }
  }, [dispatch, notifEnabled, addToast]);

  /** Android: time picker calls this directly with the new date. */
  const handleAndroidTimeChange = useCallback(
    async (_event: DateTimePickerEvent, date?: Date) => {
      setShowAndroidPicker(false);
      if (!date) return;
      const h = date.getHours();
      const m = date.getMinutes();
      if (h === notifHour && m === notifMinute) return;
      try {
        await dispatch(
          saveNotificationSettings({ dailyPromptHour: h, dailyPromptMinute: m }),
        ).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Failed to update reminder time' });
      }
    },
    [dispatch, addToast, notifHour, notifMinute],
  );

  /** iOS: "Done" pressed in the time picker modal. */
  const handleIosTimeDone = useCallback(async () => {
    setShowIosTimePicker(false);
    const h = iosPickerDate.getHours();
    const m = iosPickerDate.getMinutes();
    if (h === notifHour && m === notifMinute) return;
    try {
      await dispatch(
        saveNotificationSettings({ dailyPromptHour: h, dailyPromptMinute: m }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update reminder time' });
    }
  }, [dispatch, addToast, iosPickerDate, notifHour, notifMinute]);

  const handleOpenTimePicker = useCallback(() => {
    setIosPickerDate(buildTimeDate(notifHour, notifMinute));
    if (Platform.OS === 'ios') {
      setShowIosTimePicker(true);
    } else {
      setShowAndroidPicker(true);
    }
  }, [notifHour, notifMinute]);

  const handleToggleAutoDetect = useCallback(async () => {
    const newAutoDetect = !autoDetect;
    try {
      const updates: Parameters<typeof saveNotificationSettings>[0] = {
        autoDetectTimeZone: newAutoDetect,
      };
      if (newAutoDetect) {
        // Snap the stored TZ back to the device timezone immediately
        updates.timeZone = getDeviceTimeZone();
      }
      await dispatch(saveNotificationSettings(updates)).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update time zone settings' });
    }
  }, [dispatch, autoDetect, addToast]);

  const handleChangeTimeZone = useCallback(
    async (value: string) => {
      if (value === notifTZ) return;
      try {
        await dispatch(saveNotificationSettings({ timeZone: value })).unwrap();
      } catch {
        addToast({ type: 'error', title: 'Failed to update time zone' });
      }
    },
    [dispatch, addToast, notifTZ],
  );

  const selectedTZText =
    NOTIFICATION_TIMEZONES.find((o) => o.value === notifTZ)?.text ?? notifTZ;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
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

                {/* Tappable time display */}
                <Pressable
                  onPress={handleOpenTimePicker}
                  style={[
                    styles.timeTrigger,
                    { borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                >
                  <Text style={[styles.timeValue, { color: theme.foreground }]}>
                    {formatTime(notifHour, notifMinute)}
                  </Text>
                  <Feather name="clock" size={16} color={theme.mutedForeground} />
                </Pressable>

                {/* Android: conditionally render picker (shows as native dialog) */}
                {Platform.OS === 'android' && showAndroidPicker && (
                  <DateTimePicker
                    mode="time"
                    value={buildTimeDate(notifHour, notifMinute)}
                    display="clock"
                    onChange={handleAndroidTimeChange}
                  />
                )}
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              {/* Auto-detect time zone toggle */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowEmoji}>📍</Text>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                      Auto-detect time zone
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                      {autoDetect
                        ? `Using ${getDeviceTimeZone()}`
                        : 'Set manually below'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={autoDetect}
                  onValueChange={handleToggleAutoDetect}
                  trackColor={{ false: theme.muted, true: theme.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Manual time zone picker (only shown when auto-detect is off) */}
              {!autoDetect && (
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

      {/* iOS time picker modal */}
      <Modal
        visible={showIosTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIosTimePicker(false)}
      >
        <View style={styles.iosPickerBackdrop}>
          <View style={[styles.iosPickerSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.iosPickerHeader, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setShowIosTimePicker(false)}>
                <Text style={[styles.iosPickerCancel, { color: theme.mutedForeground }]}>
                  Cancel
                </Text>
              </Pressable>
              <Text style={[styles.iosPickerTitle, { color: theme.foreground }]}>
                Pick a time
              </Text>
              <Pressable onPress={handleIosTimeDone}>
                <Text style={[styles.iosPickerDone, { color: theme.primary }]}>
                  Done
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              mode="time"
              display="spinner"
              value={iosPickerDate}
              onChange={(_event: DateTimePickerEvent, date?: Date) => {
                if (date) setIosPickerDate(date);
              }}
              style={styles.iosPickerControl}
            />
          </View>
        </View>
      </Modal>

      {/* Back button */}
      <View
        style={[
          styles.backBar,
          {
            borderTopColor: theme.border,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.secondary, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={16} color={theme.secondaryForeground} />
          <Text style={[styles.backButtonText, { color: theme.secondaryForeground }]}>
            Go Back
          </Text>
        </Pressable>
      </View>
    </View>
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
  timeTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 20,
    marginHorizontal: 32,
  },
  backBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 13,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // iOS time picker modal
  iosPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  iosPickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iosPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  iosPickerCancel: {
    fontSize: 15,
  },
  iosPickerDone: {
    fontSize: 15,
    fontWeight: '600',
  },
  iosPickerControl: {
    height: 200,
  },
});
