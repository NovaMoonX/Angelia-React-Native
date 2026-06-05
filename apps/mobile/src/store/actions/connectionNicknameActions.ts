import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  setConnectionNickname as firestoreSetConnectionNickname,
  clearConnectionNickname as firestoreClearConnectionNickname,
} from '@/services/firebase/firestore';
import {
  setConnectionNickname as setConnectionNicknameInState,
  removeConnectionNickname,
} from '@/store/slices/connectionNicknamesSlice';
import type { RootState } from '@/store';
import { isDemoActive } from './globalActions';

export const saveConnectionNickname = createAsyncThunk(
  'connectionNicknames/save',
  async (
    { targetUserId, nickname }: { targetUserId: string; nickname: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    const trimmed = nickname.trim();
    if (isDemoActive(getState)) {
      dispatch(setConnectionNicknameInState({ targetUserId, nickname: trimmed }));
      return { targetUserId, nickname: trimmed };
    }

    try {
      if (trimmed) {
        await firestoreSetConnectionNickname(user.id, targetUserId, trimmed);
        dispatch(setConnectionNicknameInState({ targetUserId, nickname: trimmed }));
      } else {
        await firestoreClearConnectionNickname(user.id, targetUserId);
        dispatch(removeConnectionNickname(targetUserId));
      }
      return { targetUserId, nickname: trimmed };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const clearConnectionNicknameForUser = createAsyncThunk(
  'connectionNicknames/clear',
  async (targetUserId: string, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    if (isDemoActive(getState)) {
      dispatch(removeConnectionNickname(targetUserId));
      return targetUserId;
    }

    try {
      await firestoreClearConnectionNickname(user.id, targetUserId);
      dispatch(removeConnectionNickname(targetUserId));
      return targetUserId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
