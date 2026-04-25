import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  createConnectionRequest as firestoreCreateConnectionRequest,
  respondToConnectionRequest as firestoreRespondToConnectionRequest,
  createAppNotification,
  getExistingConnectionRequest,
} from '@/services/firebase/firestore';
import { updateConnectionRequest } from '@/store/slices/connectionsSlice';
import type { RootState } from '@/store';
import type { ConnectionAcceptedNotification, ConnectionRequestNotification } from '@/models/types';
import { isDemoActive } from './globalActions';
import { generateId } from '@/utils/generateId';

// ── Send a connection request ──────────────────────────────────────────────

export const sendConnectionRequest = createAsyncThunk(
  'connections/send',
  async (
    { toId, note }: { toId: string; note?: string },
    { getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    // Prevent duplicate pending/accepted requests
    if (!isDemoActive(getState)) {
      const existing = await getExistingConnectionRequest(user.id, toId);
      if (existing) return existing;
    }

    if (isDemoActive(getState)) {
      return {
        id: generateId('nano'),
        fromId: user.id,
        toId,
        status: 'pending' as const,
        createdAt: Date.now(),
        respondedAt: null,
        note: null,
      };
    }

    try {
      const request = await firestoreCreateConnectionRequest(user.id, toId, note);

      const notification: ConnectionRequestNotification = {
        id: generateId('nano'),
        type: 'connection_request',
        actorId: user.id,
        target: { type: 'user', userId: toId },
        fromId: user.id,
        fromFirstName: user.firstName,
        fromLastName: user.lastName,
        connectionRequestId: request.id,
        createdAt: Date.now(),
      };
      // Fire-and-forget — delivery failure must not block the request
      createAppNotification(notification).catch(() => {});

      return request;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Respond to a connection request ───────────────────────────────────────

export const respondToConnectionRequest = createAsyncThunk(
  'connections/respond',
  async (
    { requestId, accept }: { requestId: string; accept: boolean },
    { getState, dispatch, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    const request = state.connections.incomingRequests.find((r) => r.id === requestId);
    if (!request) return rejectWithValue('Request not found');

    const updatedRequest = {
      ...request,
      status: accept ? ('accepted' as const) : ('declined' as const),
      respondedAt: Date.now(),
    };

    if (isDemoActive(getState)) {
      dispatch(updateConnectionRequest(updatedRequest));
      return updatedRequest;
    }

    try {
      await firestoreRespondToConnectionRequest(requestId, accept);
      dispatch(updateConnectionRequest(updatedRequest));

      if (accept) {
        const notification: ConnectionAcceptedNotification = {
          id: generateId('nano'),
          type: 'connection_accepted',
          actorId: user.id,
          target: { type: 'user', userId: request.fromId },
          toFirstName: user.firstName,
          toLastName: user.lastName,
          connectionRequestId: request.id,
          createdAt: Date.now(),
        };
        // Fire-and-forget — delivery failure must not block the accept action
        createAppNotification(notification).catch(() => {});
      }

      return updatedRequest;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Process a pending connection stored before auth ───────────────────────

export const processPendingConnection = createAsyncThunk(
  'connections/processPending',
  async (_, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as RootState;
    const fromUserId = state.connections.pendingFromUserId;
    const user = state.users.currentUser;

    if (!fromUserId || !user) return null;

    try {
      const result = await dispatch(sendConnectionRequest({ toId: fromUserId })).unwrap();
      return result;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
