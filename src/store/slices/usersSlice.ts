import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/models/types';
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
  clearUsers,
  loadDemoUsers,
} = usersSlice.actions;

// Selectors
export const selectAllUsersMapById = (state: RootState) => {
  const map: Record<string, User> = {};
  for (const user of state.users.users) {
    map[user.id] = user;
  }
  return map;
};

export default usersSlice.reducer;
