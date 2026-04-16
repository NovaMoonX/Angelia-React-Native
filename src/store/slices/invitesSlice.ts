import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ChannelJoinRequest } from '@/models/types';
import { resetAllState } from '../actions/globalActions';

interface InvitesState {
  incoming: ChannelJoinRequest[];
  outgoing: ChannelJoinRequest[];
}

const initialState: InvitesState = {
  incoming: [],
  outgoing: [],
};

const invitesSlice = createSlice({
  name: 'invites',
  initialState,
  reducers: {
    setIncomingRequests(state, action: PayloadAction<ChannelJoinRequest[]>) {
      state.incoming = action.payload;
    },
    setOutgoingRequests(state, action: PayloadAction<ChannelJoinRequest[]>) {
      state.outgoing = action.payload;
    },
    updateJoinRequest(state, action: PayloadAction<ChannelJoinRequest>) {
      const inIdx = state.incoming.findIndex((r) => r.id === action.payload.id);
      if (inIdx !== -1) state.incoming[inIdx] = action.payload;

      const outIdx = state.outgoing.findIndex((r) => r.id === action.payload.id);
      if (outIdx !== -1) state.outgoing[outIdx] = action.payload;
    },
    clearInvites(state) {
      state.incoming = [];
      state.outgoing = [];
    },
    loadDemoInvites(
      state,
      action: PayloadAction<{ incoming: ChannelJoinRequest[]; outgoing: ChannelJoinRequest[] }>
    ) {
      state.incoming = action.payload.incoming;
      state.outgoing = action.payload.outgoing;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setIncomingRequests,
  setOutgoingRequests,
  updateJoinRequest,
  clearInvites,
  loadDemoInvites,
} = invitesSlice.actions;

export default invitesSlice.reducer;
