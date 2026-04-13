import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  createDailyChannel as firestoreCreateDailyChannel,
  getChannel,
} from '@/services/firebase/firestore';
import { addChannel } from '@/store/slices/channelsSlice';
import { updateAccountProgress } from './userActions';
import type { RootState } from '@/store';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';

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
      const currentUser = (getState() as RootState).users.currentUser;
      if (currentUser && !currentUser.accountProgress.dailyChannelCreated) {
        await dispatch(
          updateAccountProgress({ uid: userId, field: 'dailyChannelCreated', value: true })
        );
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

    await dispatch(createDailyChannel(userId));
    await dispatch(
      updateAccountProgress({ uid: userId, field: 'dailyChannelCreated', value: true })
    );
  }
);
