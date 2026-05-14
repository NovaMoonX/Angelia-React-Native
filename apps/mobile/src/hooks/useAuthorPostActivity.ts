import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_LAST_OPENED_AT_KEY,
  CONVERSATION_LAST_SEEN_KEY,
  POST_ACTIVITY_SEEN_KEY,
  POST_REACTIONS_SEEN_KEY,
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
  reactionsByPostId: Record<string, number>;
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

interface SeenStateCache {
  postActivitySeenAt: number | null;
  seenMaps: SeenMaps;
}
// Module-level cache shared across all hook instances in the same session.
// The first instance that finishes refreshSeenState() (typically the feed)
// populates this so subsequent instances (e.g. post-activity screen) can
// initialize with real data synchronously — no AsyncStorage round-trip needed.
const seenStateCache: Record<string, SeenStateCache> = {};

export function useAuthorPostActivity({ enableSubscriptions = false }: { enableSubscriptions?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const isDemo = useAppSelector((state) => state.demo.isActive);
  const currentUserId = useAppSelector((state) => state.users.currentUser?.id ?? null);
  const summaries = useAppSelector(selectAuthorPostActivitySummaries);
  const [postActivitySeenAt, setPostActivitySeenAt] = useState<number | null>(
    () => seenStateCache[currentUserId ?? '']?.postActivitySeenAt ?? null,
  );
  const [seenMaps, setSeenMaps] = useState<SeenMaps>(
    () => seenStateCache[currentUserId ?? '']?.seenMaps ?? { reactionsByPostId: {}, privateNotesByPostId: {}, conversationByPostId: {} },
  );

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
      setSeenMaps({ reactionsByPostId: {}, privateNotesByPostId: {}, conversationByPostId: {} });
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
      seenStateCache[currentUserId] = { postActivitySeenAt: migratedTimestamp, seenMaps: seenStateCache[currentUserId]?.seenMaps ?? { reactionsByPostId: {}, privateNotesByPostId: {}, conversationByPostId: {} } };
      await AsyncStorage.setItem(POST_ACTIVITY_SEEN_KEY(currentUserId), String(migratedTimestamp)).catch(() => {});
    } else {
      // Prefer app-last-opened when available; otherwise default to "now"
      // so users do not see a false backlog of unread activity.
      const fallbackTimestamp = parsedAppLastOpenedAt > 0 ? parsedAppLastOpenedAt : Date.now();
      const effectiveSeenAt = Math.max(parsedPostActivitySeen, fallbackTimestamp);
      setPostActivitySeenAt(effectiveSeenAt);
      seenStateCache[currentUserId] = { postActivitySeenAt: effectiveSeenAt, seenMaps: seenStateCache[currentUserId]?.seenMaps ?? { reactionsByPostId: {}, privateNotesByPostId: {}, conversationByPostId: {} } };
      if (effectiveSeenAt !== parsedPostActivitySeen) {
        await AsyncStorage.setItem(POST_ACTIVITY_SEEN_KEY(currentUserId), String(effectiveSeenAt)).catch(() => {});
      }
    }

    if (subscribedPostIds.length === 0) {
      const emptySeen: SeenMaps = { reactionsByPostId: {}, privateNotesByPostId: {}, conversationByPostId: {} };
      setSeenMaps(emptySeen);
      seenStateCache[currentUserId] = { postActivitySeenAt: seenStateCache[currentUserId]?.postActivitySeenAt ?? null, seenMaps: emptySeen };
      return;
    }

    const reactionPairs = await AsyncStorage.multiGet(
      subscribedPostIds.map((postId) => {
        return POST_REACTIONS_SEEN_KEY(currentUserId, postId);
      }),
    ).catch(() => {
      return [] as [string, string | null][];
    });

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

    const reactionsByPostId: Record<string, number> = {};
    const privateNotesByPostId: Record<string, number> = {};
    const conversationByPostId: Record<string, number> = {};

    subscribedPostIds.forEach((postId, index) => {
      reactionsByPostId[postId] = parseEpochMs(reactionPairs[index]?.[1] ?? null);
      privateNotesByPostId[postId] = parseEpochMs(privateNotePairs[index]?.[1] ?? null);
      conversationByPostId[postId] = parseEpochMs(conversationPairs[index]?.[1] ?? null);
    });

    const nextSeenMaps: SeenMaps = { reactionsByPostId, privateNotesByPostId, conversationByPostId };
    setSeenMaps(nextSeenMaps);
    seenStateCache[currentUserId] = { postActivitySeenAt: seenStateCache[currentUserId]?.postActivitySeenAt ?? null, seenMaps: nextSeenMaps };
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

  const markPostsSeen = useCallback(async (postIdsToMark: string[]) => {
    if (!currentUserId || postIdsToMark.length === 0) return;

    const seenAt = Date.now();
    await AsyncStorage.multiSet(
      postIdsToMark.flatMap((postId) => {
        return [
          [POST_REACTIONS_SEEN_KEY(currentUserId, postId), String(seenAt)] as [string, string],
          [PRIVATE_NOTES_SEEN_KEY(postId), String(seenAt)] as [string, string],
          [CONVERSATION_LAST_SEEN_KEY(postId), String(seenAt)] as [string, string],
        ];
      }),
    ).catch(() => {
      return null;
    });

    setSeenMaps((prev) => {
      const nextReactionsByPostId = { ...prev.reactionsByPostId };
      const nextPrivateNotesByPostId = { ...prev.privateNotesByPostId };
      const nextConversationByPostId = { ...prev.conversationByPostId };

      postIdsToMark.forEach((postId) => {
        nextReactionsByPostId[postId] = seenAt;
        nextPrivateNotesByPostId[postId] = seenAt;
        nextConversationByPostId[postId] = seenAt;
      });

      const nextSeenMaps: SeenMaps = {
        reactionsByPostId: nextReactionsByPostId,
        privateNotesByPostId: nextPrivateNotesByPostId,
        conversationByPostId: nextConversationByPostId,
      };

      seenStateCache[currentUserId] = {
        postActivitySeenAt: seenStateCache[currentUserId]?.postActivitySeenAt ?? postActivitySeenAt,
        seenMaps: nextSeenMaps,
      };

      return nextSeenMaps;
    });
  }, [currentUserId, postActivitySeenAt]);

  const markConversationSeen = useCallback(async (postIdsToMark?: string[]) => {
    if (!currentUserId) return;

    const targetPostIds = postIdsToMark ?? subscribedPostIds;
    if (targetPostIds.length === 0) return;

    const seenAt = Date.now();
    await AsyncStorage.multiSet(
      targetPostIds.map((postId) => {
        return [CONVERSATION_LAST_SEEN_KEY(postId), String(seenAt)] as [string, string];
      }),
    ).catch(() => {
      return null;
    });

    setSeenMaps((prev) => {
      const nextConversationByPostId = { ...prev.conversationByPostId };
      targetPostIds.forEach((postId) => {
        nextConversationByPostId[postId] = seenAt;
      });

      const nextSeenMaps: SeenMaps = {
        reactionsByPostId: prev.reactionsByPostId,
        privateNotesByPostId: prev.privateNotesByPostId,
        conversationByPostId: nextConversationByPostId,
      };

      seenStateCache[currentUserId] = {
        postActivitySeenAt: seenStateCache[currentUserId]?.postActivitySeenAt ?? postActivitySeenAt,
        seenMaps: nextSeenMaps,
      };

      return nextSeenMaps;
    });
  }, [currentUserId, postActivitySeenAt, subscribedPostIds]);

  const unreadDetailsByPostId = useMemo((): Record<string, PostUnreadDetail> => {
    // Return empty map until seen state has been loaded from storage.
    // This prevents a false "all unread" signal (postActivitySeenAt=0) from
    // firing the auto-select prematurely before the real threshold is known.
    if (postActivitySeenAt === null) return {};

    const details: Record<string, PostUnreadDetail> = {};

    summaries.forEach((summary) => {
      const postId = summary.post.id;
      const latestReactionTimestamp = getLatestReactionTimestamp(summary.post.reactions);
      const latestPrivateNoteTimestamp = summary.latestNoteTimestamp;
      const latestMessageTimestamp = summary.latestMessageTimestamp;
      const reactionsSeenBaseline = Math.max(
        postActivitySeenAt,
        seenMaps.reactionsByPostId[postId] ?? 0,
      );
      const privateNotesSeenBaseline = Math.max(
        postActivitySeenAt,
        seenMaps.privateNotesByPostId[postId] ?? 0,
      );
      const conversationSeenBaseline = Math.max(
        postActivitySeenAt,
        seenMaps.conversationByPostId[postId] ?? 0,
      );

      const hasNewReactions = latestReactionTimestamp > reactionsSeenBaseline;
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
  }, [postActivitySeenAt, seenMaps.conversationByPostId, seenMaps.privateNotesByPostId, seenMaps.reactionsByPostId, summaries]);

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
    markPostsSeen,
    markConversationSeen,
  };
}
