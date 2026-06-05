import type { Message, Post, Reaction } from '@/models/types';
import { isPendingWriteLocked } from '@/lib/pendingWrites';

export function mergePostsWithPendingWrites(
  incoming: Post[],
  localPosts: Post[],
  previousReactions: Record<string, Reaction[]>,
): Post[] {
  const localById = new Map(localPosts.map((post) => [post.id, post]));

  return incoming.map((incomingPost) => {
    const local = localById.get(incomingPost.id);
    if (!local) {
      return incomingPost;
    }

    let merged = { ...incomingPost };

    if (isPendingWriteLocked(incomingPost.id, 'reaction')) {
      merged = { ...merged, reactions: local.reactions };
    } else if (previousReactions[incomingPost.id]) {
      const snapshotHasPendingReaction = local.reactions.some((reaction) => {
        return !incomingPost.reactions.some((incomingReaction) => {
          return (
            incomingReaction.userId === reaction.userId &&
            incomingReaction.emoji === reaction.emoji
          );
        });
      });
      if (snapshotHasPendingReaction) {
        merged = { ...merged, reactions: local.reactions };
      }
    }

    if (isPendingWriteLocked(incomingPost.id, 'conversationJoin')) {
      const enrolleeSet = new Set([
        ...incomingPost.conversationEnrollees,
        ...local.conversationEnrollees,
      ]);
      merged = {
        ...merged,
        conversationEnrollees: Array.from(enrolleeSet),
      };
    }

    return merged;
  });
}

export function mergeMessagesWithPendingWrites(
  incoming: Message[],
  localMessages: Message[],
): Message[] {
  if (localMessages.length === 0) {
    return incoming;
  }

  const incomingIds = new Set(incoming.map((message) => message.id));
  const pendingLocal = localMessages.filter((message) => !incomingIds.has(message.id));

  if (pendingLocal.length === 0) {
    return incoming;
  }

  return [...incoming, ...pendingLocal].sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return a.id.localeCompare(b.id);
    }
    return a.timestamp - b.timestamp;
  });
}
