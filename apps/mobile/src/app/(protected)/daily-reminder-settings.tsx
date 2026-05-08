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
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { saveNotificationSettings } from '@/store/actions/notificationActions';

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

  // Mid-day prompt
  const midDayEnabled = notificationSettings?.dailyPrompt?.enabled ?? true;
  const midDayHour = notificationSettings?.dailyPrompt?.hour ?? 12;
  const midDayMinute = notificationSettings?.dailyPrompt?.minute ?? 30;

  // Wind-down prompt
  const windDownEnabled = notificationSettings?.windDownPrompt?.enabled ?? true;
  const windDownHour = notificationSettings?.windDownPrompt?.hour ?? 21;
  const windDownMinute = notificationSettings?.windDownPrompt?.minute ?? 0;

  // Active picker state: which prompt's time are we editing?
  type PickerTarget = 'midday' | 'winddown';
  const [activeTarget, setActiveTarget] = useState<PickerTarget>('midday');

  // iOS time picker modal state
  const [showIosTimePicker, setShowIosTimePicker] = useState(false);
  const [iosPickerDate, setIosPickerDate] = useState<Date>(() =>
    buildTimeDate(midDayHour, midDayMinute),
  );
  // Android time picker (shown as native dialog by conditionally rendering)
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  // ---- Handlers ----

  const handleToggleMidDay = useCallback(async () => {
    try {
      await dispatch(
        saveNotificationSettings({ dailyPrompt: { enabled: !midDayEnabled } }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update notification settings' });
    }
  }, [dispatch, midDayEnabled, addToast]);

  const handleToggleWindDown = useCallback(async () => {
    try {
      await dispatch(
        saveNotificationSettings({ windDownPrompt: { enabled: !windDownEnabled } }),
      ).unwrap();
    } catch {
      addToast({ type: 'error', title: 'Failed to update notification settings' });
    }
  }, [dispatch, windDownEnabled, addToast]);

  /** Shared logic for saving a time change and showing feedback. */
  const saveTimeChange = useCallback(
    async (h: number, m: number) => {
      const currentH = activeTarget === 'midday' ? midDayHour : windDownHour;
      const currentM = activeTarget === 'midday' ? midDayMinute : windDownMinute;
      if (h === currentH && m === currentM) return;
      try {
        const key = activeTarget === 'midday' ? 'dailyPrompt' : 'windDownPrompt';
        await dispatch(
          saveNotificationSettings({ [key]: { hour: h, minute: m, enabled: true } }),
        ).unwrap();
        addToast({ type: 'success', title: activeTarget === 'midday' ? 'Mid-day time updated' : 'Wind-down time updated' });
      } catch {
        addToast({ type: 'error', title: 'Failed to update reminder time' });
      }
    },
    [dispatch, addToast, activeTarget, midDayHour, midDayMinute, windDownHour, windDownMinute],
  );

  /** Android: time picker calls this directly with the new date. */
  const handleAndroidTimeChange = useCallback(
    async (_event: DateTimePickerEvent, date?: Date) => {
      setShowAndroidPicker(false);
      if (!date) return;
      await saveTimeChange(date.getHours(), date.getMinutes());
    },
    [saveTimeChange],
  );

  /** iOS: "Done" pressed in the time picker modal. */
  const handleIosTimeDone = useCallback(async () => {
    setShowIosTimePicker(false);
    await saveTimeChange(iosPickerDate.getHours(), iosPickerDate.getMinutes());
  }, [saveTimeChange, iosPickerDate]);

  const handleOpenTimePicker = useCallback((target: PickerTarget) => {
    setActiveTarget(target);
    const h = target === 'midday' ? midDayHour : windDownHour;
    const m = target === 'midday' ? midDayMinute : windDownMinute;
    setIosPickerDate(buildTimeDate(h, m));
    if (Platform.OS === 'ios') {
      setShowIosTimePicker(true);
    } else {
      setShowAndroidPicker(true);
    }
  }, [midDayHour, midDayMinute, windDownHour, windDownMinute]);

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
            Two gentle nudges a day — a mid-day check-in and an evening
            wind-down — because your people actually want to hear from you. 💛
          </Text>
        </View>

        {/* Mid-day check-in group */}
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>

          {/* Enable toggle */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowEmoji}>☀️</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                  Mid-day check-in
                </Text>
                <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                  {midDayEnabled ? "On — we'll ask how your day's going 💛" : 'Off'}
                </Text>
              </View>
            </View>
            {notificationSettings ? (
              <Switch
                value={midDayEnabled}
                onValueChange={handleToggleMidDay}
                trackColor={{ false: theme.muted, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            ) : (
              <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>
                Loading…
              </Text>
            )}
          </View>

          {midDayEnabled && notificationSettings ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              {/* Reminder time */}
              <View style={styles.rowStack}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowEmoji}>🕐</Text>
                  <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                    Check-in time
                  </Text>
                </View>

                {/* Tappable time display */}
                <Pressable
                  onPress={() => handleOpenTimePicker('midday')}
                  style={[
                    styles.timeTrigger,
                    { borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                >
                  <Text style={[styles.timeValue, { color: theme.foreground }]}>
                    {formatTime(midDayHour, midDayMinute)}
                  </Text>
                  <Feather name="clock" size={16} color={theme.mutedForeground} />
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        {/* Wind-down prompt group */}
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.border }]}>

          {/* Enable toggle */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowEmoji}>🌙</Text>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                  Evening wind-down
                </Text>
                <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                  {windDownEnabled ? "On — a cozy end-of-day nudge 🌙" : 'Off'}
                </Text>
              </View>
            </View>
            {notificationSettings ? (
              <Switch
                value={windDownEnabled}
                onValueChange={handleToggleWindDown}
                trackColor={{ false: theme.muted, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            ) : (
              <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>
                Loading…
              </Text>
            )}
          </View>

          {windDownEnabled && notificationSettings ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              {/* Reminder time */}
              <View style={styles.rowStack}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rowEmoji}>🕐</Text>
                  <Text style={[styles.rowLabel, { color: theme.foreground }]}>
                    Wind-down time
                  </Text>
                </View>

                {/* Tappable time display */}
                <Pressable
                  onPress={() => handleOpenTimePicker('winddown')}
                  style={[
                    styles.timeTrigger,
                    { borderColor: theme.border, backgroundColor: theme.background },
                  ]}
                >
                  <Text style={[styles.timeValue, { color: theme.foreground }]}>
                    {formatTime(windDownHour, windDownMinute)}
                  </Text>
                  <Feather name="clock" size={16} color={theme.mutedForeground} />
                </Pressable>

                {/* Android: conditionally render picker (shows as native dialog) */}
                {Platform.OS === 'android' && showAndroidPicker && (
                  <DateTimePicker
                    mode="time"
                    value={buildTimeDate(
                      activeTarget === 'midday' ? midDayHour : windDownHour,
                      activeTarget === 'midday' ? midDayMinute : windDownMinute,
                    )}
                    display="clock"
                    onChange={handleAndroidTimeChange}
                  />
                )}
              </View>
            </>
          ) : null}
        </View>

        {(midDayEnabled || windDownEnabled) && notificationSettings ? (
          <Text style={[styles.footerNote, { color: theme.mutedForeground }]}>
            You'll get a friendly nudge at the times you choose — tap one
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
            paddingBottom: insets.bottom + 16,
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
