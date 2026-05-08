import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { User, UserStatus, NotificationSettings, NotificationSettingsUpdate } from '@/models/types';
import { DEFAULT_WIND_DOWN_PROMPT } from '@/models/constants';
import type { RootState } from '../index';
import { resetAllState } from '../actions/globalActions';

interface UsersState {
  currentUser: User | null;
  users: User[];
  currentUserNotificationSettings: NotificationSettings | null;
}

const initialState: UsersState = {
  currentUser: null,
  users: [],
  currentUserNotificationSettings: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setCurrentUser(state, action: PayloadAction<User | null>) {
      state.currentUser = action.payload;
      // Keep users[] in sync so components reading from the array (feed, chat,
      // channel member lists) immediately reflect the current user's latest
      // profile data (name, avatar preset, custom photo URL, etc.).
      if (action.payload) {
        const idx = state.users.findIndex((u) => u.id === action.payload!.id);
        if (idx !== -1) {
          state.users[idx] = action.payload;
        } else {
          state.users.push(action.payload);
        }
      }
    },
    setUsers(state, action: PayloadAction<User[]>) {
      state.users = action.payload;
    },
    updateCurrentUser(state, action: PayloadAction<Partial<User>>) {
      if (state.currentUser) {
        Object.assign(state.currentUser, action.payload);
        // Also sync the matching entry in the users array so that components
        // reading from state.users (feed, conversation, channel members, etc.)
        // immediately reflect the updated name / avatar / photo.
        const idx = state.users.findIndex((u) => u.id === state.currentUser!.id);
        if (idx !== -1) {
          Object.assign(state.users[idx], action.payload);
        }
      }
    },
    updateCurrentUserStatus(state, action: PayloadAction<UserStatus | null>) {
      if (state.currentUser) {
        state.currentUser.status = action.payload;
        // Also update the matching entry in the users array so selectors
        // like selectPostAuthor see the new status.
        const idx = state.users.findIndex((u) => u.id === state.currentUser!.id);
        if (idx !== -1) {
          state.users[idx].status = action.payload;
        }
      }
    },
    setCurrentUserNotificationSettings(
      state,
      action: PayloadAction<NotificationSettings | null>,
    ) {
      state.currentUserNotificationSettings = action.payload;
    },
    updateCurrentUserNotificationSettings(
      state,
      action: PayloadAction<NotificationSettingsUpdate>,
    ) {
      if (state.currentUserNotificationSettings) {
        const { dailyPrompt, windDownPrompt, ...rest } = action.payload;
        Object.assign(state.currentUserNotificationSettings, rest);
        if (dailyPrompt) {
          state.currentUserNotificationSettings.dailyPrompt = {
            ...state.currentUserNotificationSettings.dailyPrompt,
            ...dailyPrompt,
          };
        }
        if (windDownPrompt) {
          state.currentUserNotificationSettings.windDownPrompt = {
            ...(state.currentUserNotificationSettings.windDownPrompt ?? DEFAULT_WIND_DOWN_PROMPT),
            ...windDownPrompt,
          };
        }
      }
    },
    clearUsers(state) {
      state.currentUser = null;
      state.users = [];
    },
    loadDemoUsers(state, action: PayloadAction<{ currentUser: User; users: User[] }>) {
      state.currentUser = action.payload.currentUser;
      state.users = action.payload.users;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setCurrentUser,
  setUsers,
  updateCurrentUser,
  updateCurrentUserStatus,
  setCurrentUserNotificationSettings,
  updateCurrentUserNotificationSettings,
  clearUsers,
  loadDemoUsers,
} = usersSlice.actions;

// Selectors
export const selectAllUsersMapById = createSelector(
  [(state: RootState) => state.users.users],
  (users) => {
    const map: Record<string, User> = {};
    for (const user of users) {
      map[user.id] = user;
    }
    return map;
  }
);

export default usersSlice.reducer;
