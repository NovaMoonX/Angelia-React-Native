import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getUserProfile,
  createUserProfile as firestoreCreateUserProfile,
  updateAccountProgress as firestoreUpdateAccountProgress,
  updateUserProfile as firestoreUpdateUserProfile,
  updateUserStatus as firestoreUpdateUserStatus,
} from '@/services/firebase/firestore';
import { setCurrentUser, updateCurrentUser, updateCurrentUserStatus } from '@/store/slices/usersSlice';
import type { NewUser, UpdateUserProfileData, UserStatus } from '@/models/types';
import type { RootState } from '@/store';
import { isDemoActive } from './globalActions';

export const fetchUserProfile = createAsyncThunk(
  'auth/fetchUserProfile',
  async (uid: string, { dispatch }) => {
    const user = await getUserProfile(uid);
    dispatch(setCurrentUser(user));
    return user;
  }
);

export const createUserProfile = createAsyncThunk(
  'auth/createUserProfile',
  async (userData: NewUser, { dispatch }) => {
    await firestoreCreateUserProfile(userData);
    const newUser = await getUserProfile(userData.id);
    dispatch(setCurrentUser(newUser));
    return newUser;
  }
);

export const updateAccountProgress = createAsyncThunk(
  'auth/accountProgress',
  async (
    { uid, field, value }: { uid: string; field: string; value: boolean },
    { dispatch }
  ) => {
    await firestoreUpdateAccountProgress(uid, field, value);
    const user = await getUserProfile(uid);
    dispatch(setCurrentUser(user));
    return user;
  }
);

export const saveProfile = createAsyncThunk(
  'users/saveProfile',
  async (
    data: UpdateUserProfileData,
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    if (isDemoActive(getState)) {
      dispatch(updateCurrentUser(data));
      return data;
    }

    try {
      await firestoreUpdateUserProfile(user.id, data);
      return data;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const saveStatus = createAsyncThunk(
  'users/saveStatus',
  async (
    status: UserStatus,
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    if (isDemoActive(getState)) {
      dispatch(updateCurrentUserStatus(status));
      return status;
    }

    try {
      await firestoreUpdateUserStatus(user.id, status);
      dispatch(updateCurrentUserStatus(status));
      return status;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const clearStatus = createAsyncThunk(
  'users/clearStatus',
  async (
    _: void,
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    if (isDemoActive(getState)) {
      dispatch(updateCurrentUserStatus(null));
      return null;
    }

    try {
      await firestoreUpdateUserStatus(user.id, null);
      dispatch(updateCurrentUserStatus(null));
      return null;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
