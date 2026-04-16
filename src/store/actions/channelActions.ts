import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  createDailyChannel as firestoreCreateDailyChannel,
  createCustomChannel as firestoreCreateChannel,
  updateCustomChannel as firestoreUpdateChannel,
  deleteCustomChannel as firestoreDeleteChannel,
  unsubscribeFromChannel as firestoreUnsubscribe,
  refreshChannelInviteCode as firestoreRefreshInvite,
  removeSubscriberFromChannel as firestoreRemoveSubscriber,
  getChannel,
} from '@/services/firebase/firestore';
import {
  addChannel,
  updateChannel,
  removeChannel,
} from '@/store/slices/channelsSlice';
import { updateAccountProgress } from './userActions';
import type { RootState } from '@/store';
import type { Channel } from '@/models/types';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';
import { generateId } from '@/utils/generateId';
import { isDemoActive } from './globalActions';

// ── Daily channel setup ────────────────────────────────────────────────────

export const createDailyChannel = createAsyncThunk(
  'channels/createDaily',
  async (userId: string, { dispatch }) => {
    const channel = await firestoreCreateDailyChannel(userId);
    dispatch(addChannel(channel));
    return channel;
  }
);

export const ensureDailyChannelExists = createAsyncThunk(
  'channels/checkDailyExists',
  async (userId: string, { getState, dispatch }) => {
    const state = getState() as RootState;
    const dailyChannelId = `${userId}${DAILY_CHANNEL_SUFFIX}`;

    const syncProgress = async () => {
      try {
        const currentUser = (getState() as RootState).users.currentUser;
        if (currentUser && !currentUser.accountProgress.dailyChannelCreated) {
          await dispatch(
            updateAccountProgress({ uid: userId, field: 'dailyChannelCreated', value: true })
          ).unwrap();
        }
      } catch {
        // Best-effort progress sync
      }
    };

    const existsInRedux = state.channels.items.some((c) => c.id === dailyChannelId);
    if (existsInRedux) {
      await syncProgress();
      return;
    }

    const channel = await getChannel(dailyChannelId);
    if (channel) {
      // Re-check Redux state after the async fetch to avoid a race with
      // subscribeToChannels' setChannels call, which could have already
      // populated the store while getChannel() was in-flight.
      const latestState = getState() as RootState;
      if (!latestState.channels.items.some((c) => c.id === dailyChannelId)) {
        dispatch(addChannel(channel));
      }
      await syncProgress();
      return;
    }

    await dispatch(createDailyChannel(userId)).unwrap();
    await dispatch(
      updateAccountProgress({ uid: userId, field: 'dailyChannelCreated', value: true })
    ).unwrap();
  }
);

// ── Custom channel CRUD ────────────────────────────────────────────────────

// Helper to build a local Channel object (used in demo mode)
function buildCustomChannel(ownerId: string, data: { name: string; description: string; color: string }): Channel {
  return {
    id: generateId('nano'),
    name: data.name.trim(),
    description: data.description.trim(),
    color: data.color,
    isDaily: false,
    ownerId,
    subscribers: [],
    inviteCode: generateId('nano').slice(0, 8).toUpperCase(),
    createdAt: Date.now(),
    markedForDeletionAt: null,
  };
}

export const createCustomChannel = createAsyncThunk(
  'channels/createCustom',
  async (
    data: { name: string; description: string; color: string },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    if (isDemoActive(getState)) {
      const newChannel = buildCustomChannel(user.id, data);
      dispatch(addChannel(newChannel));
      return newChannel;
    }

    try {
      const channel = await firestoreCreateChannel({
        name: data.name.trim(),
        description: data.description.trim(),
        color: data.color,
        ownerId: user.id,
        subscribers: [],
      });
      return channel;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const editCustomChannel = createAsyncThunk(
  'channels/editCustom',
  async (
    { channel, data }: { channel: Channel; data: { name: string; description: string; color: string } },
    { getState, dispatch, rejectWithValue },
  ) => {
    const updated: Channel = {
      ...channel,
      name: data.name.trim(),
      description: data.description.trim(),
      color: data.color,
    };

    if (isDemoActive(getState)) {
      dispatch(updateChannel(updated));
      return updated;
    }

    try {
      await firestoreUpdateChannel(updated);
      return updated;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const deleteCustomChannel = createAsyncThunk(
  'channels/deleteCustom',
  async (
    channelId: string,
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const userId = state.users.currentUser?.id || '';

    if (isDemoActive(getState)) {
      dispatch(removeChannel(channelId));
      return channelId;
    }

    try {
      await firestoreDeleteChannel(channelId, userId);
      return channelId;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Channel subscription management ────────────────────────────────────────

export const unsubscribeFromChannel = createAsyncThunk(
  'channels/unsubscribe',
  async (
    { channelId, userId }: { channelId: string; userId: string },
    { getState, rejectWithValue },
  ) => {
    if (isDemoActive(getState)) {
      return { channelId, userId };
    }
    try {
      await firestoreUnsubscribe(channelId, userId);
      return { channelId, userId };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const refreshChannelInviteCode = createAsyncThunk(
  'channels/refreshInviteCode',
  async (
    channelId: string,
    { getState, rejectWithValue },
  ) => {
    if (isDemoActive(getState)) {
      return { channelId };
    }
    try {
      await firestoreRefreshInvite(channelId);
      return { channelId };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const removeChannelSubscriber = createAsyncThunk(
  'channels/removeSubscriber',
  async (
    { channelId, subscriberId }: { channelId: string; subscriberId: string },
    { getState, rejectWithValue },
  ) => {
    if (isDemoActive(getState)) {
      return { channelId, subscriberId };
    }
    try {
      await firestoreRemoveSubscriber(channelId, subscriberId);
      return { channelId, subscriberId };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
