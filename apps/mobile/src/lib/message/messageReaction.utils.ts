import { COMMON_EMOJIS } from '@/models/constants';
import type { Message, User } from '@/models/types';
import { compareReactionGroupPriority } from '@/lib/reaction/reaction.utils';
import { getUserDisplayName } from '@/lib/user/user.utils';

export interface MessageReactionGroup {
  emoji: string;
  userIds: string[];
  count: number;
}

export function toggleMessageReactionMap(
  reactions: Record<string, string[]>,
  userId: string,
  emoji: string,
): Record<string, string[]> {
  const next = { ...reactions };
  const users = [...(next[emoji] ?? [])];
  const existingIndex = users.indexOf(userId);

  if (existingIndex >= 0) {
    users.splice(existingIndex, 1);
    if (users.length === 0) {
      delete next[emoji];
    } else {
      next[emoji] = users;
    }
    return next;
  }

  next[emoji] = [...users, userId];
  return next;
}

export interface MessageReactionDisplayGroup {
  emoji: string;
  count: number;
  names: string[];
  currentUserReacted: boolean;
}

export function getMessageReactionDisplayGroups(
  reactions: Record<string, string[]> | undefined,
  usersById: Record<string, User>,
  currentUserId: string | null,
): MessageReactionDisplayGroup[] {
  if (!reactions) {
    return [];
  }

  return getMessageReactionGroups(reactions).map((group) => {
    const names = group.userIds.map((userId) => {
      if (userId === currentUserId) {
        return 'You';
      }
      return getUserDisplayName(usersById[userId], currentUserId, userId, 'first-last-initial');
    });

    if (currentUserId && group.userIds.includes(currentUserId)) {
      const youIndex = names.indexOf('You');
      if (youIndex > 0) {
        names.splice(youIndex, 1);
        names.unshift('You');
      }
    }

    return {
      emoji: group.emoji,
      count: group.count,
      names,
      currentUserReacted: currentUserId
        ? group.userIds.includes(currentUserId)
        : false,
    };
  });
}

export function getMessageReactionGroups(
  reactions: Record<string, string[]> | undefined,
): MessageReactionGroup[] {
  if (!reactions) {
    return [];
  }

  return Object.entries(reactions)
    .filter(([, userIds]) => userIds.length > 0)
    .map(([emoji, userIds]) => ({
      emoji,
      userIds,
      count: userIds.length,
    }))
    .sort((a, b) => {
      return compareReactionGroupPriority(
        { emoji: a.emoji, count: a.count, oldestTimestamp: 0 },
        { emoji: b.emoji, count: b.count, oldestTimestamp: 0 },
      );
    });
}

export function getSuggestedMessageReactionEmojis({
  reactions,
  currentUserId,
  max = 8,
}: {
  reactions: Record<string, string[]>;
  currentUserId: string | null;
  max?: number;
}): string[] {
  const myEmojis = new Set<string>();
  const prioritized = getMessageReactionGroups(reactions)
    .filter((group) => {
      if (currentUserId && group.userIds.includes(currentUserId)) {
        myEmojis.add(group.emoji);
        return false;
      }
      return true;
    })
    .map((group) => group.emoji);

  const merged = [...prioritized, ...COMMON_EMOJIS];
  const deduped: string[] = [];

  merged.forEach((emoji) => {
    if (!emoji || myEmojis.has(emoji) || deduped.includes(emoji)) {
      return;
    }
    deduped.push(emoji);
  });

  return deduped.slice(0, Math.max(1, max));
}

export function currentUserReactedToMessageEmoji(
  reactions: Record<string, string[]> | undefined,
  emoji: string,
  currentUserId: string | null,
): boolean {
  if (!currentUserId || !reactions) {
    return false;
  }
  return (reactions[emoji] ?? []).includes(currentUserId);
}

export function isPersistedMessage(message: Message): boolean {
  return !message.id.startsWith('seed-');
}
