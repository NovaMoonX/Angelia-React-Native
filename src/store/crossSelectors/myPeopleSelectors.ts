import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { User } from '@/models/types';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';

/**
 * Derives the people list for the My People screen.
 *
 * The primary source of connections is the `connections` subcollection written
 * by the `onConnectionRequestAccepted` or `onJoinRequestAccepted` Cloud
 * Functions.  As a fallback — for when the Cloud Function is delayed or has not
 * yet run — this selector also treats any *accepted* connection request
 * (incoming or outgoing) as a connection, so the person shows up immediately
 * after acceptance without waiting for the Cloud Function.
 *
 * Each entry includes an `inCircle` flag that is `true` when the person also
 * shares at least one circle with the current user:
 *   • they are a subscriber of a non-daily circle the current user owns, OR
 *   • they are the owner of a non-daily circle the current user has joined.
 *
 * Results are alphabetically sorted by first name.
 */
export const selectMyPeopleData = createSelector(
  [
    (state: RootState) => state.connections.connections,
    (state: RootState) => state.connections.incomingRequests,
    (state: RootState) => state.connections.outgoingRequests,
    (state: RootState) => state.channels.items,
    selectAllUsersMapById,
    (state: RootState) => state.users.currentUser?.id ?? '',
  ],
  (connections, incomingRequests, outgoingRequests, channels, usersMap, currentUserId) => {
    // ── Direct connections ────────────────────────────────────────────────
    const directIds = new Set(connections.map((c) => c.userId));

    // Include users from accepted requests as a fallback for when the Cloud
    // Function hasn't yet written to the connections subcollection.
    for (const req of outgoingRequests) {
      if (req.status === 'accepted') directIds.add(req.toId);
    }
    for (const req of incomingRequests) {
      if (req.status === 'accepted') directIds.add(req.fromId);
    }

    // ── Build the set of users who also share a circle ────────────────────
    const sharedCircleIds = new Set<string>();

    // Subscribers of non-daily circles I own
    for (const ch of channels) {
      if (ch.ownerId === currentUserId && !ch.isDaily) {
        for (const sub of ch.subscribers) {
          if (sub !== currentUserId) sharedCircleIds.add(sub);
        }
      }
    }

    // Owners of non-daily circles I've joined (NOT co-subscribers)
    for (const ch of channels) {
      if (!ch.isDaily && ch.ownerId !== currentUserId && ch.subscribers.includes(currentUserId)) {
        sharedCircleIds.add(ch.ownerId);
      }
    }

    // ── Resolve + enrich ─────────────────────────────────────────────────
    const people = Array.from(directIds)
      .map((id) => {
        const user = usersMap[id];
        if (!user) return null;
        return { user, inCircle: sharedCircleIds.has(id) };
      })
      .filter((p): p is { user: User; inCircle: boolean } => !!p)
      .sort((a, b) => a.user.firstName.localeCompare(b.user.firstName));

    return { people };
  },
);
