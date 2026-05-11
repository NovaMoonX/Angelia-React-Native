import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  respondToJoinRequest as firestoreRespondToJoinRequest,
  createJoinRequest as firestoreCreateJoinRequest,
  createCircleInviteRequest as firestoreCreateCircleInviteRequest,
  respondToCircleInviteRequest as firestoreRespondToCircleInviteRequest,
  getCircleInviteRequest as firestoreGetCircleInviteRequest,
  createAppNotification,
} from '@/services/firebase/firestore';
import { updateJoinRequest, updateCircleInviteRequest } from '@/store/slices/invitesSlice';
import { clearPendingInvite } from '@/store/slices/pendingInviteSlice';
import type { RootState } from '@/store';
import type {
  ChannelJoinRequest,
  CircleInviteRequest,
  JoinChannelAcceptedNotification,
  JoinChannelRequestNotification,
} from '@/models/types';
import { isDemoActive } from './globalActions';
import { generateId } from '@/utils/generateId';

// ── Respond to a channel join request ──────────────────────────────────────

export const respondToJoinRequest = createAsyncThunk(
  'invites/respond',
  async (
    { request, accept }: { request: ChannelJoinRequest; accept: boolean },
    { getState, dispatch, rejectWithValue },
  ) => {
    const updatedRequest: ChannelJoinRequest = {
      ...request,
      status: accept ? 'accepted' : 'declined',
      respondedAt: Date.now(),
    };

    if (isDemoActive(getState)) {
      dispatch(updateJoinRequest(updatedRequest));
      return updatedRequest;
    }

    try {
      await firestoreRespondToJoinRequest(request.id, accept);
      dispatch(updateJoinRequest(updatedRequest));

      if (accept) {
        const state = getState() as RootState;
        const currentUser = state.users.currentUser;
        if (currentUser) {
          const channel = state.channels.items.find((c) => c.id === request.channelId);
          const notification: JoinChannelAcceptedNotification = {
            id: generateId('nano'),
            type: 'join_channel_accepted',
            actorId: currentUser.id,
            target: { type: 'user', userId: request.requesterId },
            channelId: request.channelId,
            channelName: channel?.name ?? 'channel',
            joinRequestId: request.id,
            createdAt: Date.now(),
          };
          // Fire-and-forget — delivery failure must not block the accept action
          createAppNotification(notification).catch(() => {});
        }
      }

      return updatedRequest;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Send a channel join request ────────────────────────────────────────────

export const sendJoinRequest = createAsyncThunk(
  'invites/send',
  async (
    {
      channelId,
      inviteCode,
      channelOwnerId,
      message,
    }: {
      channelId: string;
      inviteCode: string;
      channelOwnerId: string;
      message: string;
    },
    { getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');
    if (channelOwnerId === user.id) {
      return rejectWithValue('You cannot request to join your own Circle.');
    }

    if (isDemoActive(getState)) {
      return { channelId, message: message.trim() };
    }

    // Guard: prevent sending a new request when one is already pending for this channel
    const existingPending = state.invites.outgoing.find(
      (r) => r.channelId === channelId && r.status === 'pending',
    );
    if (existingPending) {
      return rejectWithValue('You already have a pending join request for this circle.');
    }

    try {
      const joinRequest = await firestoreCreateJoinRequest(
        channelId,
        inviteCode,
        user.id,
        channelOwnerId,
        message.trim(),
      );

      const channel = state.channels.items.find((c) => c.id === channelId);
      const notification: JoinChannelRequestNotification = {
        id: generateId('nano'),
        type: 'join_channel_request',
        actorId: user.id,
        target: { type: 'user', userId: channelOwnerId },
        requesterId: user.id,
        requesterFirstName: user.firstName,
        requesterLastName: user.lastName,
        channelId,
        channelName: channel?.name ?? 'channel',
        joinRequestId: joinRequest.id,
        createdAt: Date.now(),
      };
      // Fire-and-forget — delivery failure must not block the join request
      createAppNotification(notification).catch(() => {});

      return { channelId, message: message.trim() };
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Process a pending invite stored before auth ────────────────────────────

export const processPendingInvite = createAsyncThunk(
  'invites/processPending',
  async (_, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as RootState;
    const channel = state.pendingInvite.channel;
    const user = state.users.currentUser;

    if (!channel || !user) return null;

    try {
      const result = await dispatch(
        sendJoinRequest({
          channelId: channel.id,
          inviteCode: channel.inviteCode || '',
          channelOwnerId: channel.ownerId,
          message: '',
        }),
      ).unwrap();

      dispatch(clearPendingInvite());
      return result;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Send a custom circle invite request ──────────────────────────────────

export const sendCustomCircleInvite = createAsyncThunk(
  'invites/sendCustomCircleInvite',
  async (
    {
      channelId,
      channelName,
      inviteCode,
      targetUserId,
    }: {
      channelId: string;
      channelName: string;
      inviteCode: string;
      targetUserId: string;
    },
    { getState, rejectWithValue },
  ) => {
    const state = getState() as RootState;
    const user = state.users.currentUser;
    if (!user) return rejectWithValue('User not authenticated');

    const channel = state.channels.items.find((c) => {
      return c.id === channelId;
    });
    if (!channel) return rejectWithValue('Circle not found');
    if (channel.ownerId !== user.id) return rejectWithValue('Only the Circle host can send invites.');
    if (channel.isDaily) return rejectWithValue('Daily Circle invites are not supported here.');
    if (!inviteCode.trim() || !channel.inviteCode) return rejectWithValue('This Circle does not have a valid invite code yet.');
    if (targetUserId === user.id) return rejectWithValue('You cannot invite yourself.');
    const isConnected = state.connections.connections.some((c) => {
      return c.userId === targetUserId;
    });
    if (!isConnected) return rejectWithValue('You can only invite someone you are connected to.');
    if (channel.subscribers.includes(targetUserId)) {
      return rejectWithValue('This person is already in your Circle.');
    }
    const existingPendingInvite = state.invites.outgoingCircleInvites.find((request) => {
      return request.channelId === channelId && request.inviteeId === targetUserId && request.status === 'pending';
    });
    if (existingPendingInvite) {
      return rejectWithValue('You already sent this person an invite for this Circle.');
    }

    if (isDemoActive(getState)) {
      return { targetUserId };
    }

    try {
      const inviteRequest = await firestoreCreateCircleInviteRequest(
        channelId,
        channel.ownerId,
        user.id,
        targetUserId,
      );
      return inviteRequest;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

// ── Respond to a custom circle invite request ─────────────────────────────

export const respondToCircleInviteRequest = createAsyncThunk(
  'invites/respondToCircleInvite',
  async (
    { request, accept }: { request: CircleInviteRequest; accept: boolean },
    { getState, dispatch, rejectWithValue },
  ) => {
    const updatedRequest: CircleInviteRequest = {
      ...request,
      status: accept ? 'accepted' : 'declined',
      respondedAt: Date.now(),
    };

    if (isDemoActive(getState)) {
      dispatch(updateCircleInviteRequest(updatedRequest));
      return updatedRequest;
    }

    try {
      await firestoreRespondToCircleInviteRequest(request.id, accept);
      dispatch(updateCircleInviteRequest(updatedRequest));
      return updatedRequest;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);

export const getCircleInviteRequest = createAsyncThunk(
  'invites/getCircleInvite',
  async (requestId: string, { rejectWithValue }) => {
    try {
      return await firestoreGetCircleInviteRequest(requestId);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : err);
    }
  },
);
