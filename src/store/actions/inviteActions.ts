import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  respondToJoinRequest as firestoreRespondToJoinRequest,
  createJoinRequest as firestoreCreateJoinRequest,
} from '@/services/firebase/firestore';
import { updateJoinRequest } from '@/store/slices/invitesSlice';
import type { RootState } from '@/store';
import type { ChannelJoinRequest } from '@/models/types';
import { isDemoActive } from './globalActions';

// ── Respond to a channel join request ──────────────────────────────────────

export const respondToJoinRequest = createAsyncThunk(
  'invites/respond',
  async (
    { request, accept }: { request: ChannelJoinRequest; accept: boolean },
    { getState, dispatch, rejectWithValue },
  ) => {
    const updatedRequest: ChannelJoinRequest = {
      ...request,
      status: accept ? 'accepted' : 'declined',
      respondedAt: Date.now(),
    };

    if (isDemoActive(getState)) {
      dispatch(updateJoinRequest(updatedRequest));
      return updatedRequest;
    }

    try {
      await firestoreRespondToJoinRequest(request.id, accept);
      dispatch(updateJoinRequest(updatedRequest));
      return updatedRequest;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Send a channel join request ────────────────────────────────────────────

export const sendJoinRequest = createAsyncThunk(
  'invites/send',
  async (
    {
      channelId,
      inviteCode,
      channelOwnerId,
      message,
    }: {
      channelId: string;
      inviteCode: string;
      channelOwnerId: string;
      message: string;
    },
    { getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    if (isDemoActive(getState)) {
      return { channelId };
    }

    try {
      await firestoreCreateJoinRequest(
        channelId,
        inviteCode,
        user.id,
        channelOwnerId,
        message.trim(),
      );
      return { channelId };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
