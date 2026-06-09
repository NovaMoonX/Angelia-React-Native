import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { AppNotificationType, UserInboxItem } from '@/models/types';
import type { PostUnreadDetail } from '@/models/types';

export const selectUnreadUserInboxItems = createSelector(
  [(state: RootState) => state.userInbox.items],
  (items): UserInboxItem[] => {
    return items.filter((item) => {
      return item.readAt === null;
    });
  },
);

export const selectUnreadPostActivityInboxItems = createSelector(
  [selectUnreadUserInboxItems],
  (items): UserInboxItem[] => {
    return items.filter((item) => {
      return item.surface === 'post_activity';
    });
  },
);

export const selectUnreadNotificationsInboxItems = createSelector(
  [selectUnreadUserInboxItems],
  (items): UserInboxItem[] => {
    return items.filter((item) => {
      return item.surface === 'notifications';
    });
  },
);

export const selectHasUnreadPostActivityInbox = createSelector(
  [selectUnreadPostActivityInboxItems],
  (items): boolean => {
    return items.length > 0;
  },
);

export const selectHasUnreadNotificationsInbox = createSelector(
  [selectUnreadNotificationsInboxItems],
  (items): boolean => {
    return items.length > 0;
  },
);

const inboxTypeToUnreadFlag = (type: AppNotificationType): keyof PostUnreadDetail | null => {
  if (type === 'post_reaction') return 'hasNewReactions';
  if (type === 'private_note' || type === 'private_note_reply') return 'hasNewPrivateNotes';
  if (type === 'conversation_message') return 'hasNewMessages';
  return null;
};

const itemHasPostId = (item: UserInboxItem): item is UserInboxItem & { postId: string } => {
  return 'postId' in item && typeof item.postId === 'string';
};

export const selectUnreadDetailsByPostIdFromInbox = createSelector(
  [selectUnreadPostActivityInboxItems],
  (items): Record<string, PostUnreadDetail> => {
    const details: Record<string, PostUnreadDetail> = {};

    items.forEach((item) => {
      if (!itemHasPostId(item)) return;
      const flag = inboxTypeToUnreadFlag(item.type);
      if (flag == null) return;

      const existing = details[item.postId] ?? {
        hasNewReactions: false,
        hasNewPrivateNotes: false,
        hasNewMessages: false,
      };

      details[item.postId] = {
        ...existing,
        [flag]: true,
      };
    });

    return details;
  },
);

export interface InboxPostGroup {
  postId: string;
  items: UserInboxItem[];
}

export const selectUnreadNotificationsInboxGroupedByPost = createSelector(
  [selectUnreadNotificationsInboxItems],
  (items): { postGroups: InboxPostGroup[]; nonPostItems: UserInboxItem[] } => {
    const postGroupsMap = new Map<string, UserInboxItem[]>();
    const nonPostItems: UserInboxItem[] = [];

    items.forEach((item) => {
      if (itemHasPostId(item)) {
        const existing = postGroupsMap.get(item.postId) ?? [];
        postGroupsMap.set(item.postId, [...existing, item]);
        return;
      }
      nonPostItems.push(item);
    });

    const postGroups = Array.from(postGroupsMap.entries())
      .map(([postId, groupItems]) => {
        return {
          postId,
          items: [...groupItems].sort((a, b) => {
            return b.createdAt - a.createdAt;
          }),
        };
      })
      .sort((a, b) => {
        const aLatest = a.items[0]?.createdAt ?? 0;
        const bLatest = b.items[0]?.createdAt ?? 0;
        return bLatest - aLatest;
      });

    return { postGroups, nonPostItems };
  },
);
