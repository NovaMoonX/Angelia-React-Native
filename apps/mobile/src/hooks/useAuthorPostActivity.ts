import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_LAST_OPENED_AT_KEY,
  CONVERSATION_LAST_SEEN_KEY,
  POST_ACTIVITY_SEEN_KEY,
  PRIVATE_NOTES_SEEN_KEY,
} from '@/models/constants';
import { subscribeToMessages, subscribeToPrivateNotesForPost } from '@/services/firebase/firestore';
import { setMessages } from '@/store/slices/conversationSlice';
import { setPrivateNotes } from '@/store/slices/privateNotesSlice';
import {
  selectAuthorPostActivitySummaries,
} from '@/store/crossSelectors/activitySelectors';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import type { Reaction } from '@/models/types';

interface SeenMaps {
  privateNotesByPostId: Record<string, number>;
  conversationByPostId: Record<string, number>;
}

export interface PostUnreadDetail {
  hasNewReactions: boolean;
  hasNewPrivateNotes: boolean;
  hasNewMessages: boolean;
}

const parseEpochMs = (raw: string | null): number => {
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
};

const getLatestReactionTimestamp = (reactions: Reaction[]): number => {
  return reactions.reduce((latest, reaction) => {
    if (typeof reaction.timestamp !== 'number') return latest;
    return reaction.timestamp > latest ? reaction.timestamp : latest;
  }, 0);
};

export function useAuthorPostActivity({ enableSubscriptions = false }: { enableSubscriptions?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUserId = useAppSelector((state) => state.users.currentUser?.id ?? null);
  const summaries = useAppSelector(selectAuthorPostActivitySummaries);
  const [postActivitySeenAt, setPostActivitySeenAt] = useState<number>(0);
  const [seenMaps, setSeenMaps] = useState<SeenMaps>({
    privateNotesByPostId: {},
    conversationByPostId: {},
  });

  const postIds = useMemo(() => {
    return summaries.map((summary) => {
      return summary.post.id;
    });
  }, [summaries]);

  const postIdsKey = useMemo(() => {
    return postIds.join('|');
  }, [postIds]);

  const subscribedPostIds = useMemo(() => {
    if (!postIdsKey) return [];
    return postIdsKey.split('|');
  }, [postIdsKey]);

  const refreshSeenState = useCallback(async () => {
    if (!currentUserId) {
      setPostActivitySeenAt(0);
      setSeenMaps({ privateNotesByPostId: {}, conversationByPostId: {} });
      return;
    }

    const rawPostActivitySeen = await AsyncStorage.getItem(POST_ACTIVITY_SEEN_KEY(currentUserId)).catch(() => {
      return null;
    });
    const rawAppLastOpenedAt = await AsyncStorage.getItem(APP_LAST_OPENED_AT_KEY(currentUserId)).catch(() => {
      return null;
    });

    const parsedPostActivitySeen = parseEpochMs(rawPostActivitySeen);
    const parsedAppLastOpenedAt = parseEpochMs(rawAppLastOpenedAt);
    if (parsedPostActivitySeen === 0 && rawPostActivitySeen) {
      // Migrate legacy JSON snapshot data to timestamp format without showing false unread states.
      const migratedTimestamp = Date.now();
      setPostActivitySeenAt(migratedTimestamp);
      await AsyncStorage.setItem(POST_ACTIVITY_SEEN_KEY(currentUserId), String(migratedTimestamp)).catch(() => {});
    } else {
      // When both stored timestamps are unavailable, default to "now"
      // so users do not see a false backlog of unread activity.
      const fallbackTimestamp = parsedAppLastOpenedAt > 0 ? parsedAppLastOpenedAt : Date.now();
      const effectiveSeenAt = Math.max(parsedPostActivitySeen, fallbackTimestamp);
      setPostActivitySeenAt(effectiveSeenAt);
      if (effectiveSeenAt !== parsedPostActivitySeen) {
        await AsyncStorage.setItem(POST_ACTIVITY_SEEN_KEY(currentUserId), String(effectiveSeenAt)).catch(() => {});
      }
    }

    if (subscribedPostIds.length === 0) {
      setSeenMaps({ privateNotesByPostId: {}, conversationByPostId: {} });
      return;
    }

    const privateNotePairs = await AsyncStorage.multiGet(
      subscribedPostIds.map((postId) => {
        return PRIVATE_NOTES_SEEN_KEY(postId);
      }),
    ).catch(() => {
      return [] as [string, string | null][];
    });

    const conversationPairs = await AsyncStorage.multiGet(
      subscribedPostIds.map((postId) => {
        return CONVERSATION_LAST_SEEN_KEY(postId);
      }),
    ).catch(() => {
      return [] as [string, string | null][];
    });

    const privateNotesByPostId: Record<string, number> = {};
    const conversationByPostId: Record<string, number> = {};

    subscribedPostIds.forEach((postId, index) => {
      privateNotesByPostId[postId] = parseEpochMs(privateNotePairs[index]?.[1] ?? null);
      conversationByPostId[postId] = parseEpochMs(conversationPairs[index]?.[1] ?? null);
    });

    setSeenMaps({ privateNotesByPostId, conversationByPostId });
  }, [currentUserId, subscribedPostIds]);

  useEffect(() => {
    void refreshSeenState();
  }, [refreshSeenState]);

  useEffect(() => {
    if (!enableSubscriptions || !currentUserId || isDemo || subscribedPostIds.length === 0) return;

    const unsubscribes: Array<() => void> = [];

    subscribedPostIds.forEach((postId) => {
      const unsubMessages = subscribeToMessages(postId, (messages) => {
        dispatch(setMessages({ postId, messages }));
      });
      unsubscribes.push(unsubMessages);

      const unsubNotes = subscribeToPrivateNotesForPost(
        postId,
        (notes) => {
          dispatch(setPrivateNotes({ postId, notes }));
        },
        () => {
          dispatch(setPrivateNotes({ postId, notes: [] }));
        },
      );
      unsubscribes.push(unsubNotes);
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, [dispatch, enableSubscriptions, currentUserId, isDemo, subscribedPostIds]);

  const unreadDetailsByPostId = useMemo((): Record<string, PostUnreadDetail> => {
    const details: Record<string, PostUnreadDetail> = {};

    summaries.forEach((summary) => {
      const postId = summary.post.id;
      const latestReactionTimestamp = getLatestReactionTimestamp(summary.post.reactions);
      const latestPrivateNoteTimestamp = summary.latestNoteTimestamp;
      const latestMessageTimestamp = summary.latestMessageTimestamp;
      const privateNotesSeenBaseline = Math.max(
        postActivitySeenAt,
        seenMaps.privateNotesByPostId[postId] ?? 0,
      );
      const conversationSeenBaseline = Math.max(
        postActivitySeenAt,
        seenMaps.conversationByPostId[postId] ?? 0,
      );

      const hasNewReactions = latestReactionTimestamp > postActivitySeenAt;
      const hasNewPrivateNotes = latestPrivateNoteTimestamp > privateNotesSeenBaseline;
      const hasNewMessages = latestMessageTimestamp > conversationSeenBaseline;

      if (!hasNewReactions && !hasNewPrivateNotes && !hasNewMessages) {
        return;
      }

      details[postId] = {
        hasNewReactions,
        hasNewPrivateNotes,
        hasNewMessages,
      };
    });

    return details;
  }, [postActivitySeenAt, seenMaps.conversationByPostId, seenMaps.privateNotesByPostId, summaries]);

  const hasUnread = useMemo(() => {
    return Object.keys(unreadDetailsByPostId).length > 0;
  }, [unreadDetailsByPostId]);

  const unreadPostIds = useMemo(() => {
    return Object.keys(unreadDetailsByPostId);
  }, [unreadDetailsByPostId]);

  return {
    summaries,
    hasUnread,
    unreadPostIds,
    unreadDetailsByPostId,
    refreshSeenState,
  };
}
