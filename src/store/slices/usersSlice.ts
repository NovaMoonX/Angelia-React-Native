import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { User, UserStatus, PostTier } from '@/models/types';
import type { RootState } from '../index';
import { resetAllState } from '../actions/globalActions';

interface UsersState {
  currentUser: User | null;
  users: User[];
}

const initialState: UsersState = {
  currentUser: null,
  users: [],
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setCurrentUser(state, action: PayloadAction<User | null>) {
      state.currentUser = action.payload;
    },
    setUsers(state, action: PayloadAction<User[]>) {
      state.users = action.payload;
    },
    updateCurrentUser(state, action: PayloadAction<Partial<User>>) {
      if (state.currentUser) {
        Object.assign(state.currentUser, action.payload);
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
    updateCurrentUserTierPrefs(state, action: PayloadAction<Record<string, PostTier[]>>) {
      if (state.currentUser) {
        state.currentUser.channelTierPrefs = action.payload;
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
  updateCurrentUserTierPrefs,
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
