import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getNotificationSettings,
  initNotificationSettings,
  updateNotificationSettings as firestoreUpdateNotificationSettings,
  upsertFcmToken,
  removeFcmToken as firestoreRemoveFcmToken,
} from '@/services/firebase/firestore';
import {
  refreshFcmToken,
  getOrCreateDeviceId,
  deleteLocalFcmToken,
  getDeviceTimeZone,
  scheduleDailyPrompt,
  cancelDailyPrompt,
} from '@/services/notifications';
import {
  setCurrentUserNotificationSettings,
  updateCurrentUserNotificationSettings,
} from '@/store/slices/usersSlice';
import { retryWithBackoff } from '@/utils/retryWithBackoff';
import type { NotificationSettings, NotificationSettingsUpdate } from '@/models/types';
import type { RootState } from '@/store';
import { isDemoActive } from './globalActions';

/**
 * Loads the user's notification settings from Firestore (creating defaults on
 * first run), regenerates the device FCM token, and schedules the daily local
 * notification.  Call this on every sign-in or app launch.
 *
 * - Always reschedules local notifications so they survive app reinstalls or
 *   OS clearing.
 * - Creates notification settings with default values if they are missing.
 * - Updates only the token entry for this specific device (keyed by deviceId)
 *   to prevent token accumulation across repeated logins.
 * - FCM token registration uses retryWithBackoff for transient network failures
 *   and is fire-and-forget so it never blocks the settings UI.
 */
export const initNotifications = createAsyncThunk(
  'notifications/init',
  async (_: void, { getState, dispatch, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;

    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    try {
      const deviceTZ = getDeviceTimeZone();

      // Load or create notification settings
      let settings = await getNotificationSettings(user.id);
      if (!settings) {
        settings = await initNotificationSettings(user.id, deviceTZ);
      }

      // If the user has auto-detect enabled (or the field is absent on legacy
      // docs), silently sync the stored timezone to the current device timezone.
      const autoDetect = settings.autoDetectTimeZone !== false; // default true
      if (autoDetect && settings.timeZone !== deviceTZ) {
        settings = { ...settings, timeZone: deviceTZ };
        firestoreUpdateNotificationSettings(user.id, { timeZone: deviceTZ }).catch(() => {});
      }

      dispatch(setCurrentUserNotificationSettings(settings));

      // Always (re-)schedule the daily local notification on every login/launch
      // so notifications survive app reinstalls or OS-level clearing.  The
      // notification identifier is stable so calling this multiple times is safe.
      await scheduleDailyPrompt(settings);

      // Regenerate the FCM token on every login so we always have a fresh,
      // device-specific token registered.  Keying by deviceId means this call
      // updates the existing entry for this device rather than appending a new
      // token each time, which was causing unbounded token growth.
      // Wrapped in retryWithBackoff for transient network failures, and caught
      // so the thunk always fulfils even when FCM is unavailable (e.g. simulators).
      try {
        const entry = await retryWithBackoff(() => refreshFcmToken());
        if (entry) {
          await upsertFcmToken(user.id, entry);
        }
      } catch {
        // FCM token registration is best-effort; failure should not block the
        // settings UI or notification scheduling.
      }

      return settings;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/**
 * Persists updated notification settings to Firestore, updates Redux state,
 * and reschedules the daily local notification accordingly.
 */
export const saveNotificationSettings = createAsyncThunk(
  'notifications/saveSettings',
  async (
    data: NotificationSettingsUpdate,
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    const current = state.users.currentUserNotificationSettings;
    if (!current) return rejectWithValue('Notification settings not loaded');

    // Optimistically update Redux first so the UI reflects the change immediately
    dispatch(updateCurrentUserNotificationSettings(data));

    // Deep-merge dailyPrompt so a partial { dailyPrompt: { enabled } } update
    // doesn't lose the stored hour/minute values.
    const mergedDailyPrompt: NotificationSettings['dailyPrompt'] = data.dailyPrompt
      ? { ...current.dailyPrompt, ...data.dailyPrompt }
      : current.dailyPrompt;
    const mergedWindDownPrompt: NotificationSettings['windDownPrompt'] = data.windDownPrompt
      ? { ...(current.windDownPrompt ?? { enabled: true, hour: 17, minute: 30 }), ...data.windDownPrompt }
      : (current.windDownPrompt ?? { enabled: true, hour: 17, minute: 30 });
    const updated: NotificationSettings = {
      ...current,
      ...data,
      dailyPrompt: mergedDailyPrompt,
      windDownPrompt: mergedWindDownPrompt,
    };

    if (isDemoActive(getState)) {
      await scheduleDailyPrompt(updated);
      return updated;
    }

    try {
      await firestoreUpdateNotificationSettings(user.id, data);
      await scheduleDailyPrompt(updated);
      return updated;
    } catch (err) {
      // Roll back the optimistic update on failure by restoring the full settings
      dispatch(setCurrentUserNotificationSettings(current));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/**
 * Removes the current device's FCM token entry from Firestore, invalidates it
 * locally, and cancels the daily local notification.  Call this on sign-out.
 */
export const cleanUpNotifications = createAsyncThunk(
  'notifications/cleanUp',
  async (_: void, { getState, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;

    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return null;

    try {
      const deviceId = await getOrCreateDeviceId();
      // Remove this device's entry from Firestore so the backend can skip it
      await firestoreRemoveFcmToken(user.id, deviceId);
      // Invalidate the local token so a fresh one is issued on next sign-in
      await deleteLocalFcmToken();
      await cancelDailyPrompt();
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
    return null;
  },
);
