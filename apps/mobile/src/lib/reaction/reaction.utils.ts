import { COMMON_EMOJIS } from '@/models/constants';
import type { Reaction } from '@/models/types';

const EMOJI_STRENGTH_ORDER = ['🔥', '❤️', '🎉', '😮', '😄', '😊', '👀', '😢'];

const EMOJI_STRENGTH_RANK: Record<string, number> = EMOJI_STRENGTH_ORDER.reduce(
  (acc, emoji, index) => {
    acc[emoji] = EMOJI_STRENGTH_ORDER.length - index;
    return acc;
  },
  {} as Record<string, number>,
);

export interface ReactionGroupPriorityEntry {
  emoji: string;
  count: number;
  oldestTimestamp: number;
}

export function getEmojiStrengthRank(emoji: string): number {
  return EMOJI_STRENGTH_RANK[emoji] ?? 0;
}

export function compareReactionGroupPriority(
  a: ReactionGroupPriorityEntry,
  b: ReactionGroupPriorityEntry,
): number {
  if (b.count !== a.count) {
    return b.count - a.count;
  }
  if (a.oldestTimestamp !== b.oldestTimestamp) {
    return a.oldestTimestamp - b.oldestTimestamp;
  }
  const strengthDelta = getEmojiStrengthRank(b.emoji) - getEmojiStrengthRank(a.emoji);
  if (strengthDelta !== 0) {
    return strengthDelta;
  }
  return a.emoji.localeCompare(b.emoji);
}

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
  const reactionStatsByEmoji: Record<string, { count: number; latestTimestamp: number; oldestTimestamp: number }> = {};
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
        oldestTimestamp: timestamp,
      };
      return;
    }

    existing.count += 1;
    if (timestamp > existing.latestTimestamp) {
      existing.latestTimestamp = timestamp;
    }
    if (timestamp < existing.oldestTimestamp) {
      existing.oldestTimestamp = timestamp;
    }
  });

  const prioritizedFromOtherUsers = Object.entries(reactionStatsByEmoji)
    .map(([emoji, stats]) => {
      return {
        emoji,
        count: stats.count,
        oldestTimestamp: stats.oldestTimestamp,
      };
    })
    .sort((a, b) => {
      return compareReactionGroupPriority(a, b);
    })
    .map((entry) => {
      return entry.emoji;
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