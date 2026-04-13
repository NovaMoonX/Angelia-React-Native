import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  getUserProfile,
  createUserProfile as firestoreCreateUserProfile,
  updateAccountProgress as firestoreUpdateAccountProgress,
} from '@/services/firebase/firestore';
import { setCurrentUser } from '@/store/slices/usersSlice';
import type { NewUser } from '@/models/types';

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
