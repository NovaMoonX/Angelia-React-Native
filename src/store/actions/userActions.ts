import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getUserProfile,
  createUserProfile as firestoreCreateUserProfile,
  updateAccountProgress as firestoreUpdateAccountProgress,
  updateUserProfile as firestoreUpdateUserProfile,
} from '@/services/firebase/firestore';
import { setCurrentUser, updateCurrentUser } from '@/store/slices/usersSlice';
import type { NewUser, UpdateUserProfileData } from '@/models/types';
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
