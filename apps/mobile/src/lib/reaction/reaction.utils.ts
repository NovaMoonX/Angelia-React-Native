import { COMMON_EMOJIS } from '@/models/constants';
import type { Reaction } from '@/models/types';

interface GetSuggestedReactionEmojisOptions {
  reactions: Reaction[];
  currentUserId: string | null;
  max?: number;
}

export function getSuggestedReactionEmojis({
  reactions,
  currentUserId,
  max = 10,
}: GetSuggestedReactionEmojisOptions): string[] {
  const reactionStatsByEmoji: Record<string, { count: number; latestTimestamp: number }> = {};
  const myEmojis = new Set<string>();

  reactions.forEach((reaction) => {
      const timestamp = typeof reaction.timestamp === 'number' ? reaction.timestamp : 0;

    if (reaction.userId === currentUserId) {
      myEmojis.add(reaction.emoji);
      return;
    }

    const existing = reactionStatsByEmoji[reaction.emoji];
    if (!existing) {
      reactionStatsByEmoji[reaction.emoji] = {
        count: 1,
          latestTimestamp: timestamp,
      };
      return;
    }

    existing.count += 1;
      if (timestamp > existing.latestTimestamp) {
        existing.latestTimestamp = timestamp;
    }
  });

  const prioritizedFromOtherUsers = Object.entries(reactionStatsByEmoji)
    .sort((a, b) => {
      if (b[1].count !== a[1].count) {
        return b[1].count - a[1].count;
      }
      return b[1].latestTimestamp - a[1].latestTimestamp;
    })
    .map(([emoji]) => {
      return emoji;
    });

  const merged = [...prioritizedFromOtherUsers, ...COMMON_EMOJIS];
  const deduped: string[] = [];

  merged.forEach((emoji) => {
    if (!emoji) return;
    if (myEmojis.has(emoji)) return;
    if (deduped.includes(emoji)) return;
    deduped.push(emoji);
  });

  return deduped.slice(0, Math.max(1, max));
}