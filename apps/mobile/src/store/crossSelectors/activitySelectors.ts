import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import {
  CUSTOM_POST_RETENTION_DAYS,
  DAILY_POST_RETENTION_DAYS,
} from '@/models/constants';
import { getUserDisplayName } from '@/lib/user/user.utils';
import type { Post } from '@/models/types';

export interface AuthorPostActivitySummary {
  post: Post;
  circleLabel: string;
  reactionCount: number;
  privateNoteCount: number;
  messageCount: number;
  latestNoteTimestamp: number;
  latestMessageTimestamp: number;
  lastActivityTimestamp: number;
}

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
    (state: RootState) => state.invites.incomingCircleInvites,
    (state: RootState) => state.connections.incomingRequests,
  ],
  (incomingInvites, incomingCircleInvites, incomingConnRequests) =>
    incomingInvites.some((r) => r.status === 'pending') ||
    incomingCircleInvites.some((r) => r.status === 'pending') ||
    incomingConnRequests.some((r) => r.status === 'pending'),
);

export const selectAuthorPostActivitySummaries = createSelector(
  [
    (state: RootState) => state.users.currentUser,
    (state: RootState) => state.users.users,
    (state: RootState) => state.posts.items,
    (state: RootState) => state.channels.items,
    (state: RootState) => state.channels.connectionChannels,
    (state: RootState) => state.privateNotes.notesByPost,
    (state: RootState) => state.conversation.messagesByPost,
  ],
  (
    currentUser,
    users,
    posts,
    channels,
    connectionChannels,
    notesByPost,
    messagesByPost,
  ): AuthorPostActivitySummary[] => {
    if (!currentUser) return [];

    const now = Date.now();
    const usersById = new Map(users.map((user) => { return [user.id, user] as const; }));
    const channelById = new Map([...channels, ...connectionChannels].map((channel) => {
      return [channel.id, channel] as const;
    }));

    return posts
      .filter((post) => {
        if (post.status !== 'ready') return false;
        if (post.authorId !== currentUser.id) return false;
        const channel = channelById.get(post.channelId);
        if (!channel) return false;
        const retentionDays = channel.isDaily === true ? DAILY_POST_RETENTION_DAYS : CUSTOM_POST_RETENTION_DAYS;
        const expiresAt = post.timestamp + retentionDays * 24 * 60 * 60 * 1000;
        return expiresAt > now;
      })
      .map((post) => {
        const channel = channelById.get(post.channelId);
        const owner = channel ? usersById.get(channel.ownerId) : undefined;
        const circleLabel = channel
          ? channel.isDaily === true
            ? getUserDisplayName(owner, currentUser.id, channel.ownerId)
            : channel.name
          : 'Circle';

        const notes = notesByPost[post.id] ?? [];
        const messages = (messagesByPost[post.id] ?? []).filter((message) => {
          return message.isSystem !== true;
        });

        const latestNoteTimestamp = notes.reduce((latest, note) => {
          return note.timestamp > latest ? note.timestamp : latest;
        }, 0);
        const latestMessageTimestamp = messages.reduce((latest, message) => {
          return message.timestamp > latest ? message.timestamp : latest;
        }, 0);
        const reactionCount = post.reactions.length;
        const privateNoteCount = notes.length;
        const messageCount = messages.length;

        return {
          post,
          circleLabel,
          reactionCount,
          privateNoteCount,
          messageCount,
          latestNoteTimestamp,
          latestMessageTimestamp,
          lastActivityTimestamp: Math.max(post.timestamp, latestNoteTimestamp, latestMessageTimestamp),
        };
      })
      .sort((a, b) => {
        if (b.lastActivityTimestamp !== a.lastActivityTimestamp) {
          return b.lastActivityTimestamp - a.lastActivityTimestamp;
        }
        return b.post.timestamp - a.post.timestamp;
      });
  },
);
