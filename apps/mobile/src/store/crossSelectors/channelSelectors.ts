import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import { DAILY_CHANNEL_SUFFIX } from '@/models/constants';
import type { Channel } from '@/models/types';

/**
 * Returns the current user's daily channel, or `undefined` when not yet loaded.
 */
export const selectCurrentUserDailyChannel = createSelector(
  [
    (state: RootState) => state.channels.items,
    (state: RootState) => state.users.currentUser?.id,
  ],
  (items, userId): Channel | undefined => {
    if (!userId) return undefined;
    return items.find((c) => { return c.id === `${userId}${DAILY_CHANNEL_SUFFIX}`; });
  },
);

/**
 * Returns the current user's custom (non-daily) channels, sorted by creation date ascending.
 */
export const selectCurrentUserCustomChannels = createSelector(
  [
    (state: RootState) => state.channels.items,
    (state: RootState) => state.users.currentUser?.id,
  ],
  (items, userId): Channel[] => {
    if (!userId) return [];
    return items
      .filter((c) => { return c.ownerId === userId && !c.isDaily; })
      .sort((a, b) => { return a.createdAt - b.createdAt; });
  },
);
