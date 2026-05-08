import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { ChannelJoinRequest } from '@/models/types';

/**
 * Returns the most recent outgoing join request for a given channel, or
 * `undefined` if none exists.
 *
 * "Most recent" is determined by `createdAt` (descending), so that a new
 * pending request supersedes any older accepted/declined one when the user
 * has been removed from the circle and tries to rejoin.
 */
export const makeSelectMostRecentOutgoingRequestForChannel = (channelId: string) =>
  createSelector(
    [(state: RootState) => state.invites.outgoing],
    (outgoing): ChannelJoinRequest | undefined => {
      return outgoing
        .filter((r) => { return r.channelId === channelId; })
        .sort((a, b) => { return b.createdAt - a.createdAt; })[0];
    },
  );
