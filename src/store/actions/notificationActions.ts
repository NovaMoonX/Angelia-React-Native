import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getNotificationSettings,
  initNotificationSettings,
  updateNotificationSettings as firestoreUpdateNotificationSettings,
  addFcmToken as firestoreAddFcmToken,
  removeFcmToken as firestoreRemoveFcmToken,
} from '@/services/firebase/firestore';
import {
  getFcmToken,
  getDeviceTimeZone,
  scheduleDailyPrompt,
  cancelDailyPrompt,
} from '@/services/notifications';
import {
  setCurrentUserNotificationSettings,
  updateCurrentUserNotificationSettings,
} from '@/store/slices/usersSlice';
import type { NotificationSettings } from '@/models/types';
import type { RootState } from '@/store';
import { isDemoActive } from './globalActions';

/**
 * Loads the user's notification settings from Firestore (creating defaults on
 * first run), registers the current device FCM token, and schedules the daily
 * local notification.  Call this once after the user signs in.
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

      dispatch(setCurrentUserNotificationSettings(settings));

      // Register the FCM token for this device
      const token = await getFcmToken();
      if (token && !settings.fcmTokens.includes(token)) {
        await firestoreAddFcmToken(user.id, token);
        dispatch(
          updateCurrentUserNotificationSettings({
            fcmTokens: [...settings.fcmTokens, token],
          }),
        );
      }

      // Schedule (or cancel) the daily local notification
      await scheduleDailyPrompt(settings);

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
    data: Partial<Omit<NotificationSettings, 'fcmTokens'>>,
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    const current = state.users.currentUserNotificationSettings;
    if (!current) return rejectWithValue('Notification settings not loaded');

    // Optimistically update Redux first so the UI reflects the change immediately
    dispatch(updateCurrentUserNotificationSettings(data));

    const updated: NotificationSettings = { ...current, ...data };

    if (isDemoActive(getState)) {
      await scheduleDailyPrompt(updated);
      return updated;
    }

    try {
      await firestoreUpdateNotificationSettings(user.id, data);
      await scheduleDailyPrompt(updated);
      return updated;
    } catch (err) {
      // Roll back the optimistic update on failure
      dispatch(updateCurrentUserNotificationSettings(current));
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/**
 * Removes the current device's FCM token from Firestore and cancels
 * the daily local notification.  Call this on sign-out.
 */
export const cleanUpNotifications = createAsyncThunk(
  'notifications/cleanUp',
  async (_: void, { getState, rejectWithValue }) => {
    if (isDemoActive(getState)) return null;

    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return null;

    try {
      const token = await getFcmToken();
      if (token) {
        await firestoreRemoveFcmToken(user.id, token);
      }
      await cancelDailyPrompt();
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
    return null;
  },
);
