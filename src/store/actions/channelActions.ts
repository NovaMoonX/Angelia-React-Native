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

    const existsInRedux = state.channels.items.some((c) => c.id === dailyChannelId);
    if (existsInRedux) {
      const currentUser = state.users.currentUser;
      if (currentUser && !currentUser.accountProgress.dailyChannelCreated) {
        await dispatch(
          updateAccountProgress({ uid: userId, field: 'dailyChannelCreated', value: true })
        );
      }
      return;
    }

    const channel = await getChannel(dailyChannelId);
    if (channel) {
      dispatch(addChannel(channel));
      const currentUser = state.users.currentUser;
      if (currentUser && !currentUser.accountProgress.dailyChannelCreated) {
        await dispatch(
          updateAccountProgress({ uid: userId, field: 'dailyChannelCreated', value: true })
        );
      }
      return;
    }

    await dispatch(createDailyChannel(userId));
    await dispatch(
      updateAccountProgress({ uid: userId, field: 'dailyChannelCreated', value: true })
    );
  }
);
