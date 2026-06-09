import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { Channel } from '@/models/types';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';
import { selectAllChannels } from '@/store/slices/channelsSlice';

function isCurrentUserSubscribed(channel: Channel, userId: string): boolean {
  return Array.isArray(channel.subscribers) && channel.subscribers.includes(userId);
}

function createPlaceholderDailyChannel(ownerId: string, currentUserId: string): Channel {
  return {
    id: `${ownerId}${DAILY_CHANNEL_SUFFIX}`,
    name: 'Daily',
    description: '',
    color: '',
    isDaily: true,
    isPrivate: null,
    ownerId,
    subscribers: [currentUserId],
    inviteCode: null,
    createdAt: 0,
    markedForDeletionAt: null,
  };
}

/**
 * Circles the current user can configure for post notifications:
 * - Daily circles for every connected user (even if subscribers[] is stale)
 * - Custom circles where the user is an active subscriber
 */
export const selectInvolvedNotificationChannels = createSelector(
  [
    selectAllChannels,
    (state: RootState) => state.users.currentUser,
    (state: RootState) => state.connections.connections,
  ],
  (allChannels, currentUser, connections) => {
    if (!currentUser) {
      return [];
    }

    const connectedOwnerIds = new Set(
      connections.map((connection) => {
        return connection.userId;
      }),
    );

    const channelsById = new Map<string, Channel>();
    allChannels.forEach((channel) => {
      if (channel.markedForDeletionAt == null) {
        channelsById.set(channel.id, channel);
      }
    });

    const involved: Channel[] = [];
    const involvedIds = new Set<string>();

    connectedOwnerIds.forEach((ownerId) => {
      if (ownerId === currentUser.id) {
        return;
      }

      const dailyId = `${ownerId}${DAILY_CHANNEL_SUFFIX}`;
      const dailyChannel = channelsById.get(dailyId) ?? createPlaceholderDailyChannel(ownerId, currentUser.id);
      if (!involvedIds.has(dailyId)) {
        involvedIds.add(dailyId);
        involved.push(dailyChannel);
      }
    });

    allChannels.forEach((channel) => {
      if (channel.ownerId === currentUser.id || channel.markedForDeletionAt != null) {
        return;
      }
      if (channel.isDaily === true) {
        return;
      }
      if (!isCurrentUserSubscribed(channel, currentUser.id)) {
        return;
      }
      if (involvedIds.has(channel.id)) {
        return;
      }
      involvedIds.add(channel.id);
      involved.push(channel);
    });

    return involved;
  },
);
