import { useCallback, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_LAST_OPENED_AT_KEY,
  CONVERSATION_LAST_SEEN_KEY,
  POST_ACTIVITY_SEEN_KEY,
  POST_REACTIONS_SEEN_KEY,
  PRIVATE_NOTES_SEEN_KEY,
} from '@/models/constants';
import {
  selectAuthorPostActivitySummaries,
} from '@/store/crossSelectors/activitySelectors';
import { useAppSelector } from '@/store/hooks';
import type { Reaction } from '@/models/types';

interface SeenMaps {
  reactionsByPostId: Record<string, number>;
  privateNotesByPostId: Record<string, number>;
  conversationByPostId: Record<string, number>;
}

const getPerfNow = (): number => {
  const perfNow = globalThis.performance?.now;
  if (typeof perfNow === 'function') {
    return perfNow.call(globalThis.performance);
  }
  return Date.now();
};

const logAuthorPostActivityPerf = (event: string, details?: Record<string, number | string | boolean>) => {
  if (!__DEV__) return;
  if (details) {
    console.log(`[AuthorPostActivityPerf] ${event}`, details);
    return;
  }
  console.log(`[AuthorPostActivityPerf] ${event}`);
};

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

interface RefreshStateCache {
  promise: Promise<void> | null;
  lastCompletedAt: number;
}
// Module-level cache shared across all hook instances in the same session.
// The first instance that finishes refreshSeenState() (typically the feed)
// populates this so subsequent instances (e.g. post-activity screen) can
// initialize with real data synchronously — no AsyncStorage round-trip needed.
const seenStateCache: Record<string, SeenStateCache> = {};
const refreshStateCache: Record<string, RefreshStateCache> = {};

const RECENT_REFRESH_WINDOW_MS = 400;

export function useAuthorPostActivity() {
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
    const refreshKey = `${currentUserId ?? 'guest'}::${postIdsKey}`;
    const refreshState = refreshStateCache[refreshKey] ?? { promise: null, lastCompletedAt: 0 };
    refreshStateCache[refreshKey] = refreshState;

    if (refreshState.promise != null) {
      logAuthorPostActivityPerf('refresh_seen_state_coalesced_inflight', {
        subscribedPostCount: subscribedPostIds.length,
      });
      return refreshState.promise;
    }

    const now = Date.now();
    if (now - refreshState.lastCompletedAt < RECENT_REFRESH_WINDOW_MS) {
      logAuthorPostActivityPerf('refresh_seen_state_skipped_recent', {
        subscribedPostCount: subscribedPostIds.length,
        elapsedSinceLastMs: now - refreshState.lastCompletedAt,
      });
      return;
    }

    const runRefresh = async () => {
    const refreshStart = getPerfNow();
    logAuthorPostActivityPerf('refresh_seen_state_started', {
      subscribedPostCount: subscribedPostIds.length,
    });

    if (!currentUserId) {
      setPostActivitySeenAt(0);
      setSeenMaps({ reactionsByPostId: {}, privateNotesByPostId: {}, conversationByPostId: {} });
      logAuthorPostActivityPerf('refresh_seen_state_completed', {
        subscribedPostCount: 0,
        elapsedMs: Number((getPerfNow() - refreshStart).toFixed(1)),
      });
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
      logAuthorPostActivityPerf('refresh_seen_state_completed', {
        subscribedPostCount: 0,
        elapsedMs: Number((getPerfNow() - refreshStart).toFixed(1)),
      });
      return;
    }

    const reactionKeys = subscribedPostIds.map((postId) => {
      return POST_REACTIONS_SEEN_KEY(currentUserId, postId);
    });
    const privateNoteKeys = subscribedPostIds.map((postId) => {
      return PRIVATE_NOTES_SEEN_KEY(postId);
    });
    const conversationKeys = subscribedPostIds.map((postId) => {
      return CONVERSATION_LAST_SEEN_KEY(postId);
    });

    const allKeys = [...reactionKeys, ...privateNoteKeys, ...conversationKeys];
    const allPairs = await AsyncStorage.multiGet(allKeys).catch(() => {
      return [] as [string, string | null][];
    });
    const valueByKey = new Map<string, string | null>(allPairs);

    const reactionsByPostId: Record<string, number> = {};
    const privateNotesByPostId: Record<string, number> = {};
    const conversationByPostId: Record<string, number> = {};

    subscribedPostIds.forEach((postId) => {
      reactionsByPostId[postId] = parseEpochMs(valueByKey.get(POST_REACTIONS_SEEN_KEY(currentUserId, postId)) ?? null);
      privateNotesByPostId[postId] = parseEpochMs(valueByKey.get(PRIVATE_NOTES_SEEN_KEY(postId)) ?? null);
      conversationByPostId[postId] = parseEpochMs(valueByKey.get(CONVERSATION_LAST_SEEN_KEY(postId)) ?? null);
    });

    const nextSeenMaps: SeenMaps = { reactionsByPostId, privateNotesByPostId, conversationByPostId };
    setSeenMaps(nextSeenMaps);
    seenStateCache[currentUserId] = { postActivitySeenAt: seenStateCache[currentUserId]?.postActivitySeenAt ?? null, seenMaps: nextSeenMaps };
    logAuthorPostActivityPerf('refresh_seen_state_completed', {
      subscribedPostCount: subscribedPostIds.length,
      elapsedMs: Number((getPerfNow() - refreshStart).toFixed(1)),
    });
    };

    const inflightPromise = runRefresh()
      .finally(() => {
        refreshState.lastCompletedAt = Date.now();
        refreshState.promise = null;
      });

    refreshState.promise = inflightPromise;
    return inflightPromise;
  }, [currentUserId, postIdsKey, subscribedPostIds]);

  const markPostsSeen = useCallback(async (postIdsToMark: string[]) => {
    if (!currentUserId || postIdsToMark.length === 0) return;

    const markStart = getPerfNow();
    const seenAt = Date.now();
    await AsyncStorage.multiSet(
      postIdsToMark.map((postId) => {
        return [POST_REACTIONS_SEEN_KEY(currentUserId, postId), String(seenAt)] as [string, string];
      }),
    ).catch(() => {
      return null;
    });

    setSeenMaps((prev) => {
      const nextReactionsByPostId = { ...prev.reactionsByPostId };

      postIdsToMark.forEach((postId) => {
        nextReactionsByPostId[postId] = seenAt;
      });

      const nextSeenMaps: SeenMaps = {
        reactionsByPostId: nextReactionsByPostId,
        privateNotesByPostId: prev.privateNotesByPostId,
        conversationByPostId: prev.conversationByPostId,
      };

      seenStateCache[currentUserId] = {
        postActivitySeenAt: seenStateCache[currentUserId]?.postActivitySeenAt ?? postActivitySeenAt,
        seenMaps: nextSeenMaps,
      };

      return nextSeenMaps;
    });
    logAuthorPostActivityPerf('mark_posts_seen_completed', {
      markedCount: postIdsToMark.length,
      elapsedMs: Number((getPerfNow() - markStart).toFixed(1)),
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
