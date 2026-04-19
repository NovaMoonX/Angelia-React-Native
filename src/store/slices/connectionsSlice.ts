import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Connection, ConnectionRequest } from '@/models/types';
import { resetAllState } from '../actions/globalActions';

interface ConnectionsState {
  /** Accepted connections for the current user. */
  connections: Connection[];
  /** Incoming connection requests (toId == currentUser). */
  incomingRequests: ConnectionRequest[];
  /** Outgoing connection requests (fromId == currentUser). */
  outgoingRequests: ConnectionRequest[];
  /** userId from a deep link, waiting for auth before sending a request. */
  pendingFromUserId: string | null;
  loaded: boolean;
}

const initialState: ConnectionsState = {
  connections: [],
  incomingRequests: [],
  outgoingRequests: [],
  pendingFromUserId: null,
  loaded: false,
};

const connectionsSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    setConnections(state, action: PayloadAction<Connection[]>) {
      state.connections = action.payload;
      state.loaded = true;
    },
    setIncomingConnectionRequests(state, action: PayloadAction<ConnectionRequest[]>) {
      state.incomingRequests = action.payload;
    },
    setOutgoingConnectionRequests(state, action: PayloadAction<ConnectionRequest[]>) {
      state.outgoingRequests = action.payload;
    },
    updateConnectionRequest(state, action: PayloadAction<ConnectionRequest>) {
      const inIdx = state.incomingRequests.findIndex((r) => r.id === action.payload.id);
      if (inIdx !== -1) state.incomingRequests[inIdx] = action.payload;

      const outIdx = state.outgoingRequests.findIndex((r) => r.id === action.payload.id);
      if (outIdx !== -1) state.outgoingRequests[outIdx] = action.payload;
    },
    setPendingFromUserId(state, action: PayloadAction<string | null>) {
      state.pendingFromUserId = action.payload;
    },
    clearConnectionsPendingState(state) {
      state.pendingFromUserId = null;
    },
    loadDemoConnections(state, action: PayloadAction<Connection[]>) {
      state.connections = action.payload;
      state.loaded = true;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(resetAllState, () => initialState);
  },
});

export const {
  setConnections,
  setIncomingConnectionRequests,
  setOutgoingConnectionRequests,
  updateConnectionRequest,
  setPendingFromUserId,
  clearConnectionsPendingState,
  loadDemoConnections,
} = connectionsSlice.actions;

export default connectionsSlice.reducer;
