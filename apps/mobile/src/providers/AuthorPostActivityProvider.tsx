import React, { createContext, useMemo } from 'react';
import type { PostUnreadDetail } from '@/models/types';
import {
  selectAuthorPostActivitySummaries,
  type AuthorPostActivitySummary,
} from '@/store/crossSelectors/activitySelectors';
import {
  selectHasUnreadPostActivityInbox,
  selectUnreadDetailsByPostIdFromInbox,
} from '@/store/crossSelectors/userInboxSelectors';
import { useAppSelector } from '@/store/hooks';

export type { PostUnreadDetail };

export interface AuthorPostActivityValue {
  summaries: AuthorPostActivitySummary[];
  hasUnread: boolean;
  unreadPostIds: string[];
  unreadDetailsByPostId: Record<string, PostUnreadDetail>;
}

export const AuthorPostActivityContext = createContext<AuthorPostActivityValue | null>(null);

export function AuthorPostActivityProvider({ children }: { children: React.ReactNode }) {
  const summaries = useAppSelector(selectAuthorPostActivitySummaries);
  const hasUnread = useAppSelector(selectHasUnreadPostActivityInbox);
  const unreadDetailsByPostId = useAppSelector(selectUnreadDetailsByPostIdFromInbox);

  const unreadPostIds = useMemo(() => {
    return Object.keys(unreadDetailsByPostId);
  }, [unreadDetailsByPostId]);

  const value = useMemo<AuthorPostActivityValue>(() => {
    return {
      summaries,
      hasUnread,
      unreadPostIds,
      unreadDetailsByPostId,
    };
  }, [hasUnread, summaries, unreadDetailsByPostId, unreadPostIds]);

  return (
    <AuthorPostActivityContext.Provider value={value}>
      {children}
    </AuthorPostActivityContext.Provider>
  );
}
