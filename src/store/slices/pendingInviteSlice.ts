import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Channel } from '@/models/types';
import { resetAllState } from '../actions/globalActions';

interface PendingInviteState {
  channel: Channel | null;
}

const initialState: PendingInviteState = {
  channel: null,
};

const pendingInviteSlice = createSlice({
  name: 'pendingInvite',
  initialState,
  reducers: {
    setPendingInviteChannel(state, action: PayloadAction<Channel>) {
      state.channel = action.payload;
    },
    clearPendingInvite(state) {
      state.channel = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const { setPendingInviteChannel, clearPendingInvite } =
  pendingInviteSlice.actions;

export default pendingInviteSlice.reducer;
