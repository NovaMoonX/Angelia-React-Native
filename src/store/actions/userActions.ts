import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getUserProfile,
  createUserProfile as firestoreCreateUserProfile,
  updateAccountProgress as firestoreUpdateAccountProgress,
  updateUserProfile as firestoreUpdateUserProfile,
  updateUserStatus as firestoreUpdateUserStatus,
  updateChannelTierPrefs as firestoreUpdateChannelTierPrefs,
} from '@/services/firebase/firestore';
import { uploadUserAvatar } from '@/services/firebase/storage';
import { setCurrentUser, updateCurrentUser, updateCurrentUserStatus, updateCurrentUserTierPrefs } from '@/store/slices/usersSlice';
import type { NewUser, UpdateUserProfileData, UserStatus, PostTier, User } from '@/models/types';
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

    // Convert null → undefined so Partial<User> is satisfied in Redux state
    const stateUpdate: Partial<User> = {
      ...data,
      avatarUrl: data.avatarUrl ?? undefined,
    };

    if (isDemoActive(getState)) {
      dispatch(updateCurrentUser(stateUpdate));
      return data;
    }

    try {
      await firestoreUpdateUserProfile(user.id, data);
      dispatch(updateCurrentUser(stateUpdate));
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

export const saveTierPrefs = createAsyncThunk(
  'users/saveTierPrefs',
  async (
    prefs: Record<string, PostTier[]>,
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    dispatch(updateCurrentUserTierPrefs(prefs));

    if (isDemoActive(getState)) {
      return prefs;
    }

    try {
      await firestoreUpdateChannelTierPrefs(user.id, prefs);
      return prefs;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

/**
 * Uploads a local image URI as the user's profile avatar to Firebase Storage,
 * then persists the resulting download URL to Firestore and Redux via saveProfile.
 * Resolves to the download URL on success.
 */
export const uploadAndSaveAvatar = createAsyncThunk(
  'users/uploadAndSaveAvatar',
  async (
    fileUri: string,
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    if (isDemoActive(getState)) {
      // In demo mode just surface a local URI so the UI reflects the change
      dispatch(updateCurrentUser({ avatarUrl: fileUri }));
      return fileUri;
    }

    try {
      const downloadUrl = await uploadUserAvatar(user.id, fileUri);
      await firestoreUpdateUserProfile(user.id, {
        firstName: user.firstName,
        lastName: user.lastName,
        funFact: user.funFact,
        avatar: user.avatar,
        avatarUrl: downloadUrl,
      });
      dispatch(updateCurrentUser({ avatarUrl: downloadUrl }));
      return downloadUrl;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
