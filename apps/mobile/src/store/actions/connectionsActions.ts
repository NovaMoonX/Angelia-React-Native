import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  createConnectionRequest as firestoreCreateConnectionRequest,
  respondToConnectionRequest as firestoreRespondToConnectionRequest,
  createDisconnectRequest as firestoreCreateDisconnectRequest,
  createAppNotification,
  getExistingConnectionRequest,
} from '@/services/firebase/firestore';
import { updateConnectionRequest, removeConnection } from '@/store/slices/connectionsSlice';
import { clearConnectionNicknameForUser } from '@/store/actions/connectionNicknameActions';
import { updateChannel } from '@/store/slices/channelsSlice';
import type { RootState } from '@/store';
import type { ConnectionRequestNotification } from '@/models/types';
import { isDemoActive } from './globalActions';
import { generateId } from '@/utils/generateId';
import { dismissNotificationsByData } from '@/services/notifications';

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

    // Prevent duplicate pending requests or re-requesting while still connected.
    // Note: an 'accepted' connectionRequests doc can linger after a disconnect
    // because the Cloud Function only deletes the connections subcollection docs,
    // not the original request document.  We therefore only block on an existing
    // request when the request is still 'pending' OR the users are still actively
    // connected according to the Redux state (which is kept current by the
    // real-time Firestore listener).
    if (!isDemoActive(getState)) {
      const existing = await getExistingConnectionRequest(user.id, toId);
      if (existing) {
        const currentState = getState() as RootState;
        const isStillConnected = currentState.connections.connections.some(
          (c) => { return c.userId === toId; },
        );
        if (existing.status === 'pending' || isStillConnected) {
          return existing;
        }
      }
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
      // Dismiss the matching FCM push from the tray regardless of accept/decline
      dismissNotificationsByData({ type: 'connection_request', connectionRequestId: requestId });
      return updatedRequest;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Disconnect from a user ─────────────────────────────────────────────────

/**
 * Disconnects the current user from `targetUserId`.
 *
 * Optimistically removes the connection from Redux state so the UI updates
 * immediately.  A `disconnectRequests` document is then written to Firestore,
 * which triggers the `onDisconnectRequest` Cloud Function.  The CF deletes
 * both connection documents and removes the target from all circles owned by
 * the current user — all in a single atomic batch.
 */
export const disconnectUser = createAsyncThunk(
  'connections/disconnect',
  async (targetUserId: string, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    // Optimistic update: remove from connections list and from owned channel subscriber arrays.
    dispatch(removeConnection(targetUserId));
    dispatch(clearConnectionNicknameForUser(targetUserId));

    const ownedChannels = state.channels.items.filter((ch) => {
      return ch.ownerId === user.id && ch.subscribers.includes(targetUserId);
    });
    for (const ch of ownedChannels) {
      dispatch(
        updateChannel({
          ...ch,
          subscribers: ch.subscribers.filter((id) => { return id !== targetUserId; }),
        }),
      );
    }

    if (isDemoActive(getState)) {
      return targetUserId;
    }

    try {
      await firestoreCreateDisconnectRequest(user.id, targetUserId);
      return targetUserId;
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
