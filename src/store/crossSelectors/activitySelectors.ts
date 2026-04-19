import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

/**
 * Returns true when the current user has any pending activity that warrants
 * a notification indicator — i.e. at least one pending circle join request
 * OR at least one pending connection request.
 *
 * Used by the feed header bell icon and any other badge that needs to reflect
 * combined pending state without duplicating slice-access logic.
 */
export const selectHasAnyPendingActivity = createSelector(
  [
    (state: RootState) => state.invites.incoming,
    (state: RootState) => state.connections.incomingRequests,
  ],
  (incomingInvites, incomingConnRequests) =>
    incomingInvites.some((r) => r.status === 'pending') ||
    incomingConnRequests.some((r) => r.status === 'pending'),
);
