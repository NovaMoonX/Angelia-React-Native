import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from '@/models/types';
import type { RootState } from '../index';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';
import { resetAllState } from '../actions/globalActions';

interface ChannelsState {
  items: Channel[];
  /** Daily channels from connected users — kept separately so setChannels doesn't overwrite them. */
  connectionChannels: Channel[];
  /** Per-channel AES-256 encryption keys (hex), loaded on sign-in. */
  encryptionKeys: Record<string, string>;
}

const initialState: ChannelsState = {
  items: [],
  connectionChannels: [],
  encryptionKeys: {},
};

const channelsSlice = createSlice({
  name: 'channels',
  initialState,
  reducers: {
    setChannels(state, action: PayloadAction<Channel[]>) {
      state.items = action.payload;
    },
    setConnectionChannels(state, action: PayloadAction<Channel[]>) {
      state.connectionChannels = action.payload;
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
      state.connectionChannels = [];
    },
    loadDemoChannels(state, action: PayloadAction<Channel[]>) {
      state.items = action.payload;
    },
    setEncryptionKey(state, action: PayloadAction<{ channelId: string; key: string }>) {
      state.encryptionKeys[action.payload.channelId] = action.payload.key;
    },
    setEncryptionKeys(state, action: PayloadAction<Record<string, string>>) {
      state.encryptionKeys = { ...state.encryptionKeys, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setChannels,
  setConnectionChannels,
  addChannel,
  updateChannel,
  removeChannel,
  clearChannels,
  loadDemoChannels,
  setEncryptionKey,
  setEncryptionKeys,
} = channelsSlice.actions;

// Selectors

/** All channels: owned/subscribed channels + connected users' daily channels combined. */
export const selectAllChannels = createSelector(
  [(state: RootState) => state.channels.items, (state: RootState) => state.channels.connectionChannels],
  (items, connectionChannels) => {
    const map = new Map<string, Channel>();
    for (const ch of items) map.set(ch.id, ch);
    for (const ch of connectionChannels) {
      if (!map.has(ch.id)) map.set(ch.id, ch);
    }
    return Array.from(map.values());
  },
);

export const selectUserChannels = createSelector(
  [(state: RootState) => state.channels.items, (_state: RootState, userId: string) => userId],
  (items, userId) => items.filter((c) => c.ownerId === userId)
);

export const selectUserDailyChannel = (state: RootState, userId: string) =>
  state.channels.items.find((c) => c.id === `${userId}${DAILY_CHANNEL_SUFFIX}`);

export const selectChannelMapById = createSelector(
  [(state: RootState) => state.channels.items],
  (items) => {
    const map: Record<string, Channel> = {};
    for (const ch of items) {
      map[ch.id] = ch;
    }
    return map;
  }
);

export const selectChannelById = (state: RootState, channelId: string) =>
  state.channels.items.find((c) => c.id === channelId);

export const selectAllDailyChannels = createSelector(
  [(state: RootState) => state.channels.items],
  (items) => items.filter((c) => c.isDaily === true)
);

export default channelsSlice.reducer;
