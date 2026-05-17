import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from '@/models/types';
import type { RootState } from '../index';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';
import { resetAllState } from '../actions/globalActions';

interface ChannelsState {
  items: Channel[];
  /** Daily channels from connected users — kept separately so setChannels doesn't overwrite them. */
  connectionChannels: Channel[];
  revision: number;
}

const initialState: ChannelsState = {
  items: [],
  connectionChannels: [],
  revision: 0,
};

const channelsSlice = createSlice({
  name: 'channels',
  initialState,
  reducers: {
    setChannels(state, action: PayloadAction<Channel[]>) {
      state.items = action.payload;
      state.revision += 1;
    },
    setConnectionChannels(state, action: PayloadAction<Channel[]>) {
      state.connectionChannels = action.payload;
      state.revision += 1;
    },
    addChannel(state, action: PayloadAction<Channel>) {
      state.items.push(action.payload);
      state.revision += 1;
    },
    updateChannel(state, action: PayloadAction<Channel>) {
      const index = state.items.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
        state.revision += 1;
      }
    },
    removeChannel(state, action: PayloadAction<string>) {
      state.items = state.items.filter((c) => c.id !== action.payload);
      state.revision += 1;
    },
    clearChannels(state) {
      state.items = [];
      state.connectionChannels = [];
      state.revision += 1;
    },
    loadDemoChannels(state, action: PayloadAction<Channel[]>) {
      state.items = action.payload;
      state.revision += 1;
    },
    /**
     * Syncs the subscriber list of the current user's daily channel with their
     * actual connections. Called whenever the connections list changes so the
     * member count displayed in the UI is always accurate.
     */
    syncDailyChannelMembers(
      state,
      action: PayloadAction<{ channelId: string; memberIds: string[] }>,
    ) {
      const ch = state.items.find((c) => { return c.id === action.payload.channelId; });
      if (ch) {
        ch.subscribers = action.payload.memberIds;
        state.revision += 1;
      }
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
  syncDailyChannelMembers,
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
  (items, userId) => items.filter((c) => { return c.ownerId === userId; })
);

/** Non-daily (custom) channels owned by the given user. */
export const selectUserCustomChannels = createSelector(
  [(state: RootState) => state.channels.items, (_state: RootState, userId: string) => userId],
  (items, userId) => items.filter((c) => { return c.ownerId === userId && !c.isDaily; })
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

export const selectChannelsRevision = (state: RootState) => {
  return state.channels.revision;
};

export default channelsSlice.reducer;
