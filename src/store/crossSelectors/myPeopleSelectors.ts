import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { User } from '@/models/types';
import { selectAllUsersMapById } from '@/store/slices/usersSlice';

/**
 * Derives the two sections displayed on the My People screen:
 *
 * - `directConnections` — users who have an accepted connection with the
 *   current user (written by `onConnectionRequestAccepted` Cloud Function).
 *
 * - `circleOnlyMembers` — users who share a circle relationship but do NOT
 *   yet have a direct connection:
 *     • subscribers of custom circles the current user owns
 *     • the host (owner) of circles the current user has joined
 *       (co-members are intentionally excluded)
 *
 * Connections take dedup priority — a user who appears in both sets is
 * placed in `directConnections` only.
 *
 * Results are alphabetically sorted by first name within each section.
 */
export const selectMyPeopleData = createSelector(
  [
    (state: RootState) => state.connections.connections,
    (state: RootState) => state.channels.items,
    selectAllUsersMapById,
    (state: RootState) => state.users.currentUser?.id ?? '',
  ],
  (connections, channels, usersMap, currentUserId) => {
    // ── Direct connections ────────────────────────────────────────────────
    const directIds = new Set(connections.map((c) => c.userId));

    // ── Circles I own → collect subscribers ──────────────────────────────
    const ownedCircleMemberIds = new Set<string>();
    for (const ch of channels) {
      if (ch.ownerId === currentUserId && !ch.isDaily) {
        for (const sub of ch.subscribers) {
          if (sub !== currentUserId) ownedCircleMemberIds.add(sub);
        }
      }
    }

    // ── Circles I'm in → collect only the host (owner), NOT co-subscribers
    const joinedCircleHostIds = new Set<string>();
    for (const ch of channels) {
      if (!ch.isDaily && ch.ownerId !== currentUserId && ch.subscribers.includes(currentUserId)) {
        joinedCircleHostIds.add(ch.ownerId);
      }
    }

    // ── Circle-only = union of both circle sets, minus direct connections ─
    const circleOnlyIds = new Set<string>();
    for (const id of ownedCircleMemberIds) {
      if (!directIds.has(id)) circleOnlyIds.add(id);
    }
    for (const id of joinedCircleHostIds) {
      if (!directIds.has(id)) circleOnlyIds.add(id);
    }

    const resolveUsers = (ids: Set<string>): User[] =>
      Array.from(ids)
        .map((id) => usersMap[id])
        .filter((u): u is User => !!u)
        .sort((a, b) => a.firstName.localeCompare(b.firstName));

    return {
      directConnections: resolveUsers(directIds),
      circleOnlyMembers: resolveUsers(circleOnlyIds),
    };
  },
);
