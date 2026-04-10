import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from '@/models/types';
import type { RootState } from '../index';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';

interface ChannelsState {
  items: Channel[];
}

const initialState: ChannelsState = {
  items: [],
};

const channelsSlice = createSlice({
  name: 'channels',
  initialState,
  reducers: {
    setChannels(state, action: PayloadAction<Channel[]>) {
      state.items = action.payload;
    },
    addChannel(state, action: PayloadAction<Channel>) {
      state.items.push(action.payload);
    },
    updateChannel(state, action: PayloadAction<Channel>) {
      const index = state.items.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeChannel(state, action: PayloadAction<string>) {
      state.items = state.items.filter((c) => c.id !== action.payload);
    },
    clearChannels(state) {
      state.items = [];
    },
    loadDemoChannels(state, action: PayloadAction<Channel[]>) {
      state.items = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase('RESET_ALL_STATE', () => initialState);
  },
});

export const {
  setChannels,
  addChannel,
  updateChannel,
  removeChannel,
  clearChannels,
  loadDemoChannels,
} = channelsSlice.actions;

// Selectors
export const selectUserChannels = (state: RootState, userId: string) =>
  state.channels.items.filter((c) => c.ownerId === userId);

export const selectUserDailyChannel = (state: RootState, userId: string) =>
  state.channels.items.find((c) => c.id === `${userId}${DAILY_CHANNEL_SUFFIX}`);

export const selectChannelMapById = (state: RootState) => {
  const map: Record<string, Channel> = {};
  for (const ch of state.channels.items) {
    map[ch.id] = ch;
  }
  return map;
};

export const selectChannelById = (state: RootState, channelId: string) =>
  state.channels.items.find((c) => c.id === channelId);

export const selectAllDailyChannels = (state: RootState) =>
  state.channels.items.filter((c) => c.isDaily === true);

export default channelsSlice.reducer;
